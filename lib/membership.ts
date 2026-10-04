import { z } from "zod";
import { memberInput } from "./import";

export const membershipFormInput = memberInput.extend({
  gender: z.enum(["M", "F"]),
  idNumber: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9 -]+$/),
  village: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(24).regex(/^[+0-9 ()-]*[0-9][+0-9 ()-]*$/),
});

export const membershipHeaderInput = z.object({
  branch: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
});

export type MembershipFormMember = {
  firstName: string;
  lastName: string;
  gender?: string | null;
  idNumber?: string | null;
  village?: string | null;
  memberNumber: string;
  phone?: string | null;
};

export type MembershipForm = {
  constituency: string;
  branch?: string | null;
  district?: string | null;
  members: MembershipFormMember[];
};

export function snapshotMembers(snapshot: unknown): MembershipFormMember[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const text = (key: string) => typeof row[key] === "string" ? row[key] as string : "";
    return [{
      firstName: text("firstName"),
      lastName: text("lastName"),
      gender: text("gender"),
      idNumber: text("idNumber"),
      village: text("village"),
      memberNumber: text("memberNumber"),
      phone: text("phone"),
    }];
  });
}
