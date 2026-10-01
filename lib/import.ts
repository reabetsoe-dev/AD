import Papa from "papaparse";
import { z } from "zod";
export const memberInput = z.object({
  memberNumber: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .max(24)
    .regex(/^[+0-9 ()-]*$/)
    .optional()
    .default(""),
  membershipStatus: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export function parseMembers(csv: string, existingNumbers: string[] = []) {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const errors: { row: number; message: string }[] = parsed.errors.map((e) => ({
    row: (e.row ?? 0) + 2,
    message: e.message,
  }));
  const rows: z.infer<typeof memberInput>[] = [];
  const seen = new Set(existingNumbers);
  if (
    !parsed.meta.fields?.includes("memberNumber") ||
    !parsed.meta.fields.includes("firstName") ||
    !parsed.meta.fields.includes("lastName")
  )
    errors.push({
      row: 1,
      message: "Required headers: memberNumber,firstName,lastName",
    });
  if (parsed.data.length > 500)
    errors.push({ row: 1, message: "Maximum 500 records per import." });
  parsed.data.slice(0, 500).forEach((raw, index) => {
    if (raw.constituencyId || raw.role) {
      errors.push({
        row: index + 2,
        message: "Constituency and role cannot be supplied in an import.",
      });
      return;
    }
    const valid = memberInput.safeParse({
      ...raw,
      membershipStatus: raw.membershipStatus || "ACTIVE",
    });
    if (!valid.success) {
      errors.push({
        row: index + 2,
        message: valid.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
      return;
    }
    if (seen.has(valid.data.memberNumber))
      errors.push({
        row: index + 2,
        message: `Duplicate member number: ${valid.data.memberNumber}`,
      });
    else {
      seen.add(valid.data.memberNumber);
      rows.push(valid.data);
    }
  });
  if (!parsed.data.length)
    errors.push({ row: 1, message: "The file has no member records." });
  return { rows, errors, valid: errors.length === 0 };
}
