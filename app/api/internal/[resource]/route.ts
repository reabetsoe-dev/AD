import { z } from "zod";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { can, scopeFor, type Permission } from "@/lib/permissions";
import {
  errorResponse,
  HttpError,
  requireUser,
  sameOrigin,
} from "@/lib/security";
import { parseMembers } from "@/lib/import";
import { membershipFormInput, membershipHeaderInput, snapshotMembers, type MembershipForm } from "@/lib/membership";
import { membershipPdf } from "@/lib/membership-pdf";
import { saveUpload, storage } from "@/lib/storage";
import {
  contentAttachmentCategories,
  uploadCategoryForFile,
  uploadCategoryFromPath,
} from "@/lib/upload-rules";
import { Prisma } from "@prisma/client";
import { mediaCategories, mediaCategoryFor, mediaLinkUrl, mediaUploadCategories } from "@/lib/media";
const contentKinds = ["news", "events", "media", "documents", "manifesto", "content"];
function attachmentCategory(value: FormDataEntryValue | null | undefined) {
  if (value instanceof File && value.size)
    return uploadCategoryForFile(
      value.name,
      value.type,
      contentAttachmentCategories,
    );
  if (typeof value === "string" && value)
    return uploadCategoryFromPath(value, contentAttachmentCategories);
  return null;
}
async function access(resource: string, write = false) {
  const user = await requireUser();
  let permission: Permission;
  if (["members", "import", "submissions"].includes(resource))
    permission =
      user.role === "SECRETARY_GENERAL"
        ? "SUBMIT_CONSTITUENCY_MEMBERSHIP"
        : write
          ? "REVIEW_MEMBERSHIP"
          : "VIEW_ALL_MEMBERSHIP";
  else if (resource === "collections")
    permission =
      user.role === "SECRETARY_GENERAL"
        ? "SUBMIT_COLLECTION_REPORT"
        : write
          ? "VERIFY_PAYMENTS"
          : "VIEW_FINANCE";
  else if (resource === "music") permission = "MANAGE_MUSIC";
  else if (resource === "users") permission = "MANAGE_USERS";
  else if (resource === "constituencies") permission = "MANAGE_CONSTITUENCIES";
  else if (resource === "audit") permission = "VIEW_AUDIT_LOG";
  else if (resource === "media") permission = "MANAGE_MEDIA";
  else if (contentKinds.includes(resource)) permission = "MANAGE_CONTENT";
  else if (["payments", "reports"].includes(resource))
    permission = "VIEW_FINANCE";
  else throw new HttpError(404, "Resource not found.");
  if (!can(user.role, permission))
    throw new HttpError(403, "You do not have access to this area.");
  return user;
}
const audit = (
  actorUserId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Prisma.InputJsonValue,
) => ({ actorUserId, action, entityType, entityId, metadata });
type ReportRow = Record<string, unknown>;
type PdfReport = {
  title: string;
  columns: string[];
  rows: string[][];
};
const reportTitles: Record<string, string> = {
  members: "Membership",
  submissions: "Membership submissions",
  collections: "Collections",
  reports: "Reports",
  payments: "Payments",
  music: "Music",
  users: "Users",
  constituencies: "Constituencies",
  audit: "Audit log",
  content: "Content",
  news: "News",
  events: "Events",
  media: "Media",
  documents: "Documents",
  manifesto: "Manifesto",
};
function isRecord(value: unknown): value is ReportRow {
  return !!value && typeof value === "object";
}
function rowsFrom(records: unknown): ReportRow[] {
  return Array.isArray(records) ? records.filter(isRecord) : [];
}
function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "--";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint"
  )
    return String(value);
  if (typeof value === "object" && "toString" in value) {
    const text = String(value);
    return text === "[object Object]" ? "--" : text;
  }
  return "--";
}
function optionalText(value: unknown): string {
  const text = valueText(value);
  return text === "--" ? "" : text;
}
function joinText(...parts: string[]) {
  return parts.filter(Boolean).join(" ") || "--";
}
function relationName(row: ReportRow, key: string): string {
  const value = row[key];
  return isRecord(value) && "name" in value
    ? valueText(value.name)
    : valueText(value);
}
function countValue(row: ReportRow, key: string): string {
  return isRecord(row._count) ? valueText(row._count[key]) : "0";
}
function dateValue(value: unknown): string {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? valueText(value) : date.toISOString().slice(0, 10);
}
function moneyValue(row: ReportRow, key: string): string {
  const amount = valueText(row[key]);
  return amount === "--"
    ? "--"
    : `${optionalText(row.currency) || process.env.STORE_CURRENCY || "LSL"} ${amount}`;
}
function paymentTrack(row: ReportRow): string {
  const purchase = row.purchase;
  if (!isRecord(purchase)) return "--";
  const track = purchase.track;
  return isRecord(track) ? valueText(track.title) : "--";
}
function contentStatus(row: ReportRow): string {
  return row.isPublished ? "PUBLISHED" : "DRAFT";
}
function musicStatus(row: ReportRow): string {
  return row.archived ? "ARCHIVED" : row.isPublished ? "PUBLISHED" : "DRAFT";
}
function reportFor(resource: string, records: unknown): PdfReport {
  const rows = rowsFrom(records),
    title = reportTitles[resource] || resource;
  if (resource === "members")
    return {
      title,
      columns: ["Member", "Constituency", "Status"],
      rows: rows.map((row) => {
        const phone = optionalText(row.phone),
          member = joinText(optionalText(row.firstName), optionalText(row.lastName));
        return [
          phone ? `${member} (${phone})` : member,
          relationName(row, "constituency"),
          valueText(row.membershipStatus),
        ];
      }),
    };
  if (resource === "submissions")
    return {
      title,
      columns: ["Reporting period", "Constituency", "Members", "Status"],
      rows: rows.map((row) => [
        valueText(row.reportingPeriod),
        relationName(row, "constituency"),
        valueText(row.memberCount),
        valueText(row.status),
      ]),
    };
  if (resource === "collections" || resource === "reports")
    return {
      title,
      columns: [
        "Reporting period",
        "Constituency",
        "Reported",
        "Verified",
        "Reference",
        "Status",
      ],
      rows: rows.map((row) => [
        valueText(row.reportingPeriod),
        relationName(row, "constituency"),
        moneyValue(row, "reportedAmount"),
        moneyValue(row, "verifiedAmount"),
        valueText(row.paymentReference),
        valueText(row.status),
      ]),
    };
  if (resource === "payments")
    return {
      title,
      columns: ["Track", "Amount", "Reference", "Status", "Date"],
      rows: rows.map((row) => [
        paymentTrack(row),
        moneyValue(row, "amount"),
        valueText(row.providerTransactionId),
        valueText(row.status),
        dateValue(row.createdAt),
      ]),
    };
  if (resource === "music")
    return {
      title,
      columns: ["Track", "Type", "Price", "Downloads", "Status"],
      rows: rows.map((row) => [
        joinText(optionalText(row.title), optionalText(row.artist)),
        valueText(row.downloadType),
        moneyValue(row, "price"),
        countValue(row, "downloads"),
        musicStatus(row),
      ]),
    };
  if (resource === "users")
    return {
      title,
      columns: ["User", "Role", "Constituency", "Status"],
      rows: rows.map((row) => [
        joinText(optionalText(row.name), optionalText(row.email)),
        valueText(row.role).replaceAll("_", " "),
        relationName(row, "assignedConstituency"),
        row.disabled ? "DISABLED" : "ACTIVE",
      ]),
    };
  if (resource === "constituencies")
    return {
      title,
      columns: ["Constituency", "Number", "Members"],
      rows: rows.map((row) => [
        valueText(row.name),
        valueText(row.code),
        countValue(row, "members"),
      ]),
    };
  if (resource === "audit")
    return {
      title,
      columns: ["Action", "Actor", "Entity", "Date"],
      rows: rows.map((row) => [
        valueText(row.action),
        relationName(row, "actorUser"),
        valueText(row.entityType),
        dateValue(row.createdAt),
      ]),
    };
  return {
    title,
    columns: ["Title", "Type", "Status", "Date"],
    rows: rows.map((row) => [
      valueText(row.title),
      resource === "events" ? dateValue(row.eventDate) : valueText(row.kind),
      contentStatus(row),
      dateValue(row.createdAt),
    ]),
  };
}
function cleanPdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function fitPdfCell(value: string, width: number) {
  const text = cleanPdfText(value);
  if (text.length <= width) return text.padEnd(width, " ");
  if (width <= 3) return text.slice(0, width);
  return `${text.slice(0, width - 3)}...`;
}
function escapePdfText(value: string) {
  return cleanPdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
function reportLines(report: PdfReport) {
  const lineLength = 132,
    columnWidth = Math.max(
      10,
      Math.floor((lineLength - report.columns.length + 1) / report.columns.length),
    ),
    header = report.columns.map((column) => fitPdfCell(column, columnWidth)).join(" "),
    divider = report.columns.map(() => "-".repeat(columnWidth)).join(" ");
  return {
    header,
    divider,
    rows: report.rows.length
      ? report.rows.map((row) =>
          report.columns
            .map((_, index) => fitPdfCell(row[index] || "--", columnWidth))
            .join(" "),
        )
      : ["No records found."],
  };
}
function pageContent(
  report: PdfReport,
  lines: string[],
  page: number,
  pageCount: number,
) {
  const commands = [
    "BT",
    "/F1 16 Tf",
    "40 555 Td",
    `(${escapePdfText(report.title)}) Tj`,
    "/F1 9 Tf",
    "0 -22 Td",
    "(AD Digital Platform report) Tj",
    "0 -20 Td",
  ];
  for (const line of lines) commands.push(`(${escapePdfText(line)}) Tj`, "0 -14 Td");
  commands.push(`(${escapePdfText(`Page ${page + 1} of ${pageCount}`)}) Tj`, "ET");
  return commands.join("\n");
}
function pdfBytes(report: PdfReport) {
  const encoder = new TextEncoder(),
    { header, divider, rows } = reportLines(report),
    maxRowsPerPage = 28,
    chunks: string[][] = [];
  for (let i = 0; i < rows.length; i += maxRowsPerPage)
    chunks.push(rows.slice(i, i + maxRowsPerPage));
  if (!chunks.length) chunks.push([]);
  const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    ],
    pageIds: number[] = [];
  chunks.forEach((chunk, index) => {
    const lines = [header, divider, ...chunk],
      content = pageContent(report, lines, index, chunks.length),
      contentId = objects.length + 1;
    objects.push(
      `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    );
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
  });
  objects[1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(pdf);
}
export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    const resource = (await context.params).resource,
      user = await access(resource),
      scope = user.role === "SECRETARY_GENERAL" ? scopeFor(user) : {};
    const url = new URL(request.url);
    const exporting = ["pdf", "csv"].includes(url.searchParams.get("export") || "");
    if (exporting && ["members", "submissions", "constituencies"].includes(resource)) {
      const forms: MembershipForm[] = [];
      const id = url.searchParams.get("id");
      if (resource === "submissions") {
        const submissions = await db.membershipSubmission.findMany({
          where: { ...scope, ...(id ? { id } : {}) },
          include: { constituency: true },
          orderBy: { submittedAt: "desc" },
        });
        if (id && !submissions.length) throw new HttpError(404, "Submission not found.");
        for (const submission of submissions) forms.push({
          constituency: submission.constituencyName ?? submission.constituency.name,
          branch: submission.branch ?? submission.constituency.branch,
          district: submission.district ?? submission.constituency.district,
          members: snapshotMembers(submission.snapshot),
        });
      } else {
        const constituencies = await db.constituency.findMany({
          where: user.role === "SECRETARY_GENERAL"
            ? { id: scopeFor(user).constituencyId }
            : id ? { id } : {},
          include: { members: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] } },
          orderBy: { name: "asc" },
        });
        if (id && !constituencies.length) throw new HttpError(404, "Constituency not found.");
        for (const constituency of constituencies) forms.push({
          constituency: constituency.name,
          branch: constituency.branch,
          district: constituency.district,
          members: constituency.members,
        });
      }
      const bytes = await membershipPdf(forms);
      await db.auditLog.create({
        data: audit(user.id, "REPORT_EXPORTED", resource, id || undefined, {
          count: forms.reduce((count, form) => count + form.members.length, 0),
          format: "pdf",
        }),
      });
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="ad-membership-${resource}${id ? `-${id.replace(/[^A-Za-z0-9-]/g, "")}` : ""}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    let records: unknown = [];
    if (resource === "members")
      records = await db.member.findMany({
        where: scope,
        include: { constituency: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    else if (resource === "submissions")
      records = await db.membershipSubmission.findMany({
        where: scope,
        select: {
          id: true,
          reportingPeriod: true,
          constituencyName: true,
          branch: true,
          district: true,
          memberCount: true,
          status: true,
          notes: true,
          submittedAt: true,
          constituency: { select: { name: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 100,
      });
    else if (resource === "collections" || resource === "reports") {
      const status = z
        .enum(["PENDING_VERIFICATION", "VERIFIED", "REJECTED"])
        .safeParse(url.searchParams.get("status"));
      const constituencyId = url.searchParams.get("constituencyId");
      records = await db.collectionReport.findMany({
        where: {
          ...scope,
          ...(user.role !== "SECRETARY_GENERAL" && constituencyId
            ? { constituencyId }
            : {}),
          ...(status.success ? { status: status.data } : {}),
        },
        include: { constituency: { select: { name: true } } },
        orderBy: { submittedAt: "desc" },
        take: 500,
      });
    } else if (resource === "music") {
      const archived = z
        .enum(["active", "archived", "all"])
        .catch("all")
        .parse(url.searchParams.get("archived") || "all");
      records = await db.track.findMany({
        where: archived === "all" ? {} : { archived: archived === "archived" },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { purchases: true, downloads: true } } },
      });
    } else if (resource === "payments")
      records = await db.paymentTransaction.findMany({
        include: {
          purchase: {
            select: { track: { select: { title: true } }, phoneMasked: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    else if (resource === "users")
      records = await db.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          disabled: true,
          assignedConstituencyId: true,
          assignedConstituency: { select: { name: true } },
        },
      });
    else if (resource === "constituencies")
      records = await db.constituency.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          district: true,
          branch: true,
          _count: { select: { members: true, submissions: true } },
        },
      });
    else if (resource === "audit")
      records = await db.auditLog.findMany({
        include: { actorUser: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    else if (contentKinds.includes(resource))
      records = await db.content.findMany({
        where: resource === "content" ? {} : { kind: resource },
        orderBy: { createdAt: "desc" },
      });
    if (exporting) {
      const report = reportFor(resource, records);
      await db.auditLog.create({
        data: audit(user.id, "REPORT_EXPORTED", resource, undefined, {
          count: report.rows.length,
          format: "pdf",
        }),
      });
      return new Response(pdfBytes(report), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="demo-${resource}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return Response.json(
      { records },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    sameOrigin(request);
    const resource = (await context.params).resource,
      user = await access(resource, true);
    if (resource === "music") {
      const form = await request.formData();
      const input = z
        .object({
          id: z.string().optional(),
          title: z.string().trim().min(1).max(120),
          artist: z.string().trim().min(1).max(100),
          description: z.string().max(2000),
          category: z.string().min(1).max(60),
          downloadType: z.enum(["FREE", "PAID"]),
          price: z.coerce.number().min(0).max(100000),
          isPublished: z.coerce.boolean(),
          archived: z.coerce.boolean().optional(),
        })
        .parse(Object.fromEntries(form));
      if (input.downloadType === "PAID" && input.price <= 0)
        throw new HttpError(
          400,
          "A paid track needs a price greater than zero.",
        );
      const old = input.id
        ? await db.track.findUnique({ where: { id: input.id } })
        : null;
      if (input.id && !old) throw new HttpError(404, "Track not found.");
      const audioStorageKey =
        (await saveUpload(form.get("audio"), "audio", false, user.id)) ||
        old?.audioStorageKey;
      const previewUrl =
        (await saveUpload(form.get("preview"), "audio", true, user.id)) ||
        old?.previewUrl;
      if (!audioStorageKey || !previewUrl)
        throw new HttpError(400, "Full audio and preview files are required.");
      const artworkUrl =
        (await saveUpload(form.get("artwork"), "image", true, user.id)) ||
        old?.artwork ||
        "/ad-logo.png";
      const { id, ...fields } = input;
      const data = {
        ...fields,
        price: input.downloadType === "FREE" ? 0 : input.price,
        audioStorageKey,
        previewUrl,
        artwork: artworkUrl,
        currency: process.env.STORE_CURRENCY || "LSL",
      };
      const track = await db.$transaction(async (tx) => {
        const t = id
          ? await tx.track.update({ where: { id }, data })
          : await tx.track.create({
              data: { ...data, slug: `demo-${randomUUID()}` },
            });
        await tx.auditLog.create({
          data: audit(
            user.id,
            old ? "TRACK_UPDATED" : "TRACK_UPLOADED",
            "Track",
            t.id,
          ),
        });
        if (old?.isPublished !== t.isPublished)
          await tx.auditLog.create({
            data: audit(
              user.id,
              t.isPublished ? "TRACK_PUBLISHED" : "TRACK_UNPUBLISHED",
              "Track",
              t.id,
            ),
          });
        if (old && !old.price.equals(t.price))
          await tx.auditLog.create({
            data: audit(user.id, "TRACK_PRICE_CHANGED", "Track", t.id, {
              previous: old.price.toString(),
              current: t.price.toString(),
            }),
          });
        return t;
      });
      return Response.json({ id: track.id });
    }
    if (contentKinds.includes(resource)) {
      const isMultipart = request.headers
        .get("content-type")
        ?.includes("multipart/form-data");
      const form = isMultipart ? await request.formData() : null;
      const raw = form ? Object.fromEntries(form) : await request.json();
      const input = z
        .object({
          id: z.string().optional(),
          title: z.string().min(1).max(200),
          summary: z.string().min(1).max(500),
          body: resource === "media" ? z.string().max(20000).default("") : z.string().min(1).max(resource === "manifesto" ? 200000 : 20000),
          isPublished: form
            ? z.coerce.boolean().default(false)
            : z.boolean().default(false),
          eventDate: z.string().optional(),
          mediaCategory: z.enum(mediaCategories).optional(),
          mediaSource: z.enum(["file", "link"]).optional(),
          externalUrl: z.string().trim().max(2000).optional(),
        })
        .parse(raw);
      const old = input.id
        ? await db.content.findFirst({
            where: {
              id: input.id,
              ...(resource !== "content" ? { kind: resource } : {}),
            },
          })
        : null;
      if (input.id && !old) throw new HttpError(404, "Content not found.");
      const isMedia = resource === "media";
      const attachment = form?.get("attachment");
      const category = attachmentCategory(attachment);
      const mediaCategory = mediaCategoryFor({
        mediaCategory: input.mediaCategory || old?.mediaCategory,
        attachmentCategory: category || (old?.storageKey ? uploadCategoryFromPath(old.storageKey) : null),
        externalUrl: input.externalUrl || old?.externalUrl,
      });
      const mediaSource = input.mediaSource || ((input.externalUrl ?? old?.externalUrl) ? "link" : "file");
      const externalUrl = mediaLinkUrl(input.externalUrl ?? old?.externalUrl);
      if (isMedia && mediaSource === "link" && !externalUrl)
        throw new HttpError(400, "Enter a valid HTTP or HTTPS media link.");
      const hasAttachment =
        (attachment instanceof File && !!attachment.size) ||
        (typeof attachment === "string" && !!attachment);
      if (hasAttachment && !category)
        throw new HttpError(400, "Unsupported attachment file type or size.");
      const existingCategory = old?.storageKey ? uploadCategoryFromPath(old.storageKey) : old?.image ? "image" : null;
      if (isMedia && mediaSource === "file") {
        const fileCategory = category || existingCategory;
        if (!fileCategory && (input.isPublished || input.mediaSource))
          throw new HttpError(400, "Upload a media file or select Link.");
        if (fileCategory && !mediaUploadCategories[mediaCategory].includes(fileCategory))
          throw new HttpError(400, "The file type does not match the selected media category.");
      }
      const storageKey = category && (!isMedia || mediaSource === "file")
        ? await saveUpload(attachment, category, false, user.id)
        : undefined;
      const { id, eventDate } = input;
      const data = {
        title: input.title,
        summary: input.summary,
        body: input.body,
        isPublished: input.isPublished,
        ...(resource === "events"
          ? { eventDate: eventDate ? new Date(eventDate) : null }
          : {}),
        ...(storageKey ? { storageKey } : {}),
        ...(isMedia ? {
          mediaCategory,
          externalUrl: mediaSource === "link" ? externalUrl : null,
          ...(mediaSource === "link" ? { storageKey: null, image: null } : storageKey ? { image: null } : {}),
        } : {}),
      };
      await db.$transaction(async (tx) => {
        const c = id
          ? await tx.content.update({ where: { id }, data })
          : await tx.content.create({ data: { ...data, kind: resource } });
        await tx.auditLog.create({
          data: audit(user.id, "CONTENT_UPDATED", "Content", c.id),
        });
      });
      return Response.json({ ok: true });
    }
    const body = await request.json();
    if (resource === "members") {
      const constituencyOfficial = user.role === "SECRETARY_GENERAL";
      if (
        constituencyOfficial &&
        body.constituencyId &&
        body.constituencyId !== user.assignedConstituencyId
      )
        throw new HttpError(403, "Constituency access denied.");
      const scope = constituencyOfficial ? scopeFor(user) : {};
      await db.$transaction(async (tx) => {
        if (body.id) {
          const existing = await tx.member.findFirst({
            where: { id: z.string().parse(body.id), ...scope },
          });
          if (!existing) throw new HttpError(404, "Member not found.");
          const input = membershipFormInput.parse(body);
          await tx.member.update({ where: { id: existing.id }, data: input });
          await tx.auditLog.create({
            data: audit(user.id, "MEMBER_UPDATED", "Member", existing.id),
          });
        } else {
          const input = membershipFormInput.parse(body);
          const constituencyId = constituencyOfficial
            ? scopeFor(user).constituencyId
            : z.string().min(1).parse(body.constituencyId);
          const m = await tx.member.create({
            data: { ...input, constituencyId },
          });
          await tx.auditLog.create({
            data: audit(user.id, "MEMBER_CREATED", "Member", m.id),
          });
        }
      });
      return Response.json({ ok: true });
    }
    if (resource === "import") {
      const { csv, confirm } = z
        .object({
          csv: z.string().max(1024 * 1024),
          confirm: z.boolean().default(false),
        })
        .parse(body);
      const scope = scopeFor(user);
      if (body.constituencyId && body.constituencyId !== scope.constituencyId)
        throw new HttpError(403, "Constituency access denied.");
      const members = await db.member.findMany({
        where: scope,
        select: { memberNumber: true },
      });
      const result = parseMembers(
        csv,
        members.map((m) => m.memberNumber),
      );
      if (!confirm || !result.valid)
        return Response.json(result, {
          status: confirm && !result.valid ? 400 : 200,
        });
      const sourceKey = await storage.put(
        new File([csv], "import.csv", { type: "text/csv" }),
        "csv",
      );
      await db.$transaction(async (tx) => {
        await tx.member.createMany({
          data: result.rows.map((row) => ({ ...row, ...scope })),
        });
        await tx.auditLog.create({
          data: audit(
            user.id,
            "MEMBERSHIP_IMPORTED",
            "Constituency",
            scope.constituencyId,
            { count: result.rows.length, sourceKey },
          ),
        });
      });
      return Response.json({ ok: true, count: result.rows.length });
    }
    if (resource === "submissions") {
      if (user.role !== "SECRETARY_GENERAL") {
        const { id, status, notes } = z
          .object({
            id: z.string(),
            status: z.enum(["UNDER_REVIEW", "ACCEPTED", "REJECTED"]),
            notes: z.string().max(1000),
          })
          .parse(body);
        await db.$transaction([
          db.membershipSubmission.update({ where: { id }, data: { status } }),
          db.auditLog.create({
            data: audit(
              user.id,
              "MEMBERSHIP_REVIEWED",
              "MembershipSubmission",
              id,
              { status, notes },
            ),
          }),
        ]);
        return Response.json({ ok: true });
      }
      const { id, reportingPeriod, notes, branch, district } = membershipHeaderInput
          .extend({
            id: z.string().optional(),
            reportingPeriod: z.string().min(1).max(80),
            notes: z.string().max(1000).optional(),
          })
          .parse(body),
        scope = scopeFor(user);
      const submissionId = await db.$transaction(async (tx) => {
        if (id) {
          const existing = await tx.membershipSubmission.findFirst({
            where: { id, ...scope },
          });
          if (!existing) throw new HttpError(404, "Submission not found.");
          if (!["SUBMITTED", "UNDER_REVIEW"].includes(existing.status))
            throw new HttpError(409, "Reviewed submissions cannot be edited.");
          await tx.membershipSubmission.update({
            where: { id },
            data: {
              reportingPeriod,
              notes,
              constituencyName: existing.constituencyName ?? user.assignedConstituency?.name,
              branch: existing.branch ?? branch,
              district: existing.district ?? district,
            },
          });
          await tx.auditLog.create({
            data: audit(
              user.id,
              "MEMBERSHIP_SUBMISSION_UPDATED",
              "MembershipSubmission",
              id,
            ),
          });
          return existing.id;
        }
        const members = await tx.member.findMany({
          where: scope,
          select: {
            memberNumber: true,
            firstName: true,
            lastName: true,
            gender: true,
            idNumber: true,
            village: true,
            phone: true,
            membershipStatus: true,
          },
        });
        const s = await tx.membershipSubmission.create({
          data: {
            ...scope,
            submittedById: user.id,
            reportingPeriod,
            constituencyName: user.assignedConstituency?.name,
            branch,
            district,
            notes,
            memberCount: members.length,
            snapshot: members,
          },
        });
        await tx.auditLog.create({
          data: audit(
            user.id,
            "MEMBERSHIP_SUBMITTED",
            "MembershipSubmission",
            s.id,
            { memberCount: members.length },
          ),
        });
        return s.id;
      });
      return Response.json({
        ok: true,
        id: submissionId,
        downloadUrl: `/api/internal/submissions?export=pdf&id=${encodeURIComponent(submissionId)}`,
      });
    }
    if (resource === "collections") {
      if (user.role === "SECRETARY_GENERAL") {
        const input = z
          .object({
            id: z.string().optional(),
            reportingPeriod: z.string().min(1).max(80),
            amount: z.coerce.number().positive().max(1000000),
            paymentReference: z.string().min(4).max(120),
            notes: z.string().max(1000).optional(),
          })
          .parse(body);
        if (
          body.constituencyId &&
          body.constituencyId !== user.assignedConstituencyId
        )
          throw new HttpError(403, "Constituency access denied.");
        await db.$transaction(async (tx) => {
          if (input.id) {
            const existing = await tx.collectionReport.findFirst({
              where: { id: input.id, ...scopeFor(user) },
            });
            if (!existing)
              throw new HttpError(404, "Collection report not found.");
            if (existing.status !== "PENDING_VERIFICATION")
              throw new HttpError(
                409,
                "Verified or rejected collection reports cannot be edited.",
              );
            await tx.collectionReport.update({
              where: { id: input.id },
              data: {
                reportingPeriod: input.reportingPeriod,
                expectedAmount: input.amount,
                reportedAmount: input.amount,
                paymentReference: input.paymentReference,
                notes: input.notes,
              },
            });
            await tx.auditLog.create({
              data: audit(
                user.id,
                "COLLECTION_UPDATED",
                "CollectionReport",
                input.id,
              ),
            });
            return;
          }
          const c = await tx.collectionReport.create({
            data: {
              ...scopeFor(user),
              submittedById: user.id,
              reportingPeriod: input.reportingPeriod,
              expectedAmount: input.amount,
              reportedAmount: input.amount,
              currency: process.env.STORE_CURRENCY || "LSL",
              paymentReference: input.paymentReference,
              notes: input.notes,
            },
          });
          await tx.auditLog.create({
            data: audit(
              user.id,
              "COLLECTION_SUBMITTED",
              "CollectionReport",
              c.id,
            ),
          });
        });
        return Response.json({ ok: true });
      }
      if (process.env.DEMO_MODE !== "true")
        throw new HttpError(
          503,
          "An authorised payment verification provider is required.",
        );
      const { id, status, verifiedAmount, verificationNotes } = z
        .object({
          id: z.string(),
          status: z.enum(["VERIFIED", "REJECTED"]),
          verifiedAmount: z.coerce.number().min(0).max(1000000),
          verificationNotes: z.string().trim().min(5).max(1000),
        })
        .parse(body);
      await db.$transaction(async (tx) => {
        const existing = await tx.collectionReport.findUnique({
          where: { id },
        });
        if (!existing || existing.status !== "PENDING_VERIFICATION")
          throw new HttpError(
            409,
            "This report is no longer pending verification.",
          );
        if (existing.submittedById === user.id)
          throw new HttpError(
            403,
            "You cannot verify your own collection report.",
          );
        const changed = await tx.collectionReport.updateMany({
          where: { id, status: "PENDING_VERIFICATION" },
          data: {
            status,
            verifiedAmount: status === "VERIFIED" ? verifiedAmount : null,
            verifiedById: user.id,
            verifiedAt: new Date(),
            verificationNotes,
          },
        });
        if (!changed.count)
          throw new HttpError(409, "This report has already been reviewed.");
        await tx.auditLog.create({
          data: audit(
            user.id,
            status === "VERIFIED"
              ? "COLLECTION_VERIFIED"
              : "COLLECTION_REJECTED",
            "CollectionReport",
            id,
            {
              demo: true,
              reportedAmount: existing.reportedAmount.toString(),
              verifiedAmount,
              status,
              verificationNotes,
            },
          ),
        });
      });
      return Response.json({ ok: true });
    }
    if (resource === "constituencies") {
      const input = z
        .object({
          id: z.string().optional(),
          name: z.string().trim().min(1).max(100),
          code: z.string().trim().min(1).max(40),
          district: membershipHeaderInput.shape.district,
          branch: membershipHeaderInput.shape.branch.optional(),
        })
        .parse(body);
      const { id, ...fields } = input;
      const c = id
        ? await db.constituency.update({ where: { id }, data: fields })
        : await db.constituency.create({ data: fields });
      await db.auditLog.create({
        data: audit(
          user.id,
          id ? "CONSTITUENCY_UPDATED" : "CONSTITUENCY_CREATED",
          "Constituency",
          c.id,
        ),
      });
      return Response.json({ ok: true });
    }
    if (resource === "users") {
      const input = z
        .object({
          id: z.string().optional(),
          name: z.string().min(1).max(100),
          email: z.email(),
          role: z.enum([
            "SUPER_ADMIN",
            "ADMIN",
            "FINANCE_OFFICER",
            "MEDIA_MANAGER",
            "EDITOR",
            "SECRETARY_GENERAL",
            "AUDITOR",
          ]),
          assignedConstituencyId: z.string().nullable().optional(),
          disabled: z.boolean().default(false),
          password: z.string().min(12).max(128).optional(),
        })
        .parse(body);
      const target = input.id
        ? await db.user.findUnique({ where: { id: input.id } })
        : null;
      if (
        user.role !== "SUPER_ADMIN" &&
        (input.role === "SUPER_ADMIN" || target?.role === "SUPER_ADMIN")
      )
        throw new HttpError(
          403,
          "Only Super Admin can manage Super Admin accounts.",
        );
      if (user.id === input.id)
        throw new HttpError(400, "You cannot change your own account here.");
      const assignedConstituencyId =
        input.role === "SECRETARY_GENERAL"
          ? input.assignedConstituencyId
          : null;
      if (input.role === "SECRETARY_GENERAL" && !assignedConstituencyId)
        throw new HttpError(
          400,
          "Secretary General requires an assigned constituency.",
        );
      if (!target && !input.password)
        throw new HttpError(400, "A temporary password is required.");
      const { password, id, ...fields } = input;
      await db.$transaction(async (tx) => {
        const u = id
          ? await tx.user.update({
              where: { id },
              data: { ...fields, assignedConstituencyId },
            })
          : await tx.user.create({
              data: {
                ...fields,
                assignedConstituencyId,
                id: randomUUID(),
                emailVerified: true,
              },
            });
        if (password)
          await tx.account.upsert({
            where: {
              providerId_accountId: {
                providerId: "credential",
                accountId: u.id,
              },
            },
            create: {
              id: randomUUID(),
              accountId: u.id,
              providerId: "credential",
              userId: u.id,
              password: await hashPassword(password),
            },
            update: { password: await hashPassword(password) },
          });
        if (id) await tx.session.deleteMany({ where: { userId: id } });
        await tx.auditLog.create({
          data: audit(
            user.id,
            id ? "USER_UPDATED" : "USER_CREATED",
            "User",
            u.id,
            { role: u.role, disabled: u.disabled },
          ),
        });
        if (target && target.role !== u.role)
          await tx.auditLog.create({
            data: audit(user.id, "ROLE_CHANGED", "User", u.id, {
              previous: target.role,
              current: u.role,
            }),
          });
      });
      return Response.json({ ok: true });
    }
    throw new HttpError(405, "This resource is read-only.");
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    sameOrigin(request);
    const resource = (await context.params).resource,
      user = await access(resource, true),
      { id } = z.object({ id: z.string().min(1) }).parse(await request.json());
    if (resource === "members") {
      const scope = user.role === "SECRETARY_GENERAL" ? scopeFor(user) : {};
      await db.$transaction(async (tx) => {
        const existing = await tx.member.findFirst({ where: { id, ...scope } });
        if (!existing) throw new HttpError(404, "Member not found.");
        await tx.member.delete({ where: { id: existing.id } });
        await tx.auditLog.create({
          data: audit(user.id, "MEMBER_REMOVED", "Member", existing.id),
        });
      });
      return Response.json({ ok: true, message: "Member removed." });
    }
    if (resource === "submissions") {
      const scope = user.role === "SECRETARY_GENERAL" ? scopeFor(user) : {};
      await db.$transaction(async (tx) => {
        const existing = await tx.membershipSubmission.findFirst({
          where: { id, ...scope },
        });
        if (!existing) throw new HttpError(404, "Submission not found.");
        if (existing.status !== "SUBMITTED")
          throw new HttpError(
            409,
            "Only unreviewed submissions can be removed.",
          );
        await tx.membershipSubmission.delete({ where: { id } });
        await tx.auditLog.create({
          data: audit(
            user.id,
            "MEMBERSHIP_SUBMISSION_REMOVED",
            "MembershipSubmission",
            id,
          ),
        });
      });
      return Response.json({ ok: true, message: "Submission removed." });
    }
    if (resource === "collections") {
      if (!["SECRETARY_GENERAL", "ADMIN", "SUPER_ADMIN"].includes(user.role))
        throw new HttpError(
          403,
          "Only administrators or the submitting constituency can remove collection reports.",
        );
      const scope = user.role === "SECRETARY_GENERAL" ? scopeFor(user) : {};
      await db.$transaction(async (tx) => {
        const existing = await tx.collectionReport.findFirst({
          where: { id, ...scope },
        });
        if (!existing) throw new HttpError(404, "Collection report not found.");
        if (existing.status !== "PENDING_VERIFICATION")
          throw new HttpError(
            409,
            "Verified or rejected collection reports cannot be removed.",
          );
        await tx.collectionReport.delete({ where: { id } });
        await tx.auditLog.create({
          data: audit(user.id, "COLLECTION_REMOVED", "CollectionReport", id),
        });
      });
      return Response.json({ ok: true, message: "Collection report removed." });
    }
    if (resource === "music") {
      await db.$transaction(async (tx) => {
        const track = await tx.track.findUnique({ where: { id } });
        if (!track) throw new HttpError(404, "Track not found.");
        await tx.downloadEntitlement.deleteMany({
          where: { purchase: { trackId: id } },
        });
        await tx.paymentTransaction.deleteMany({
          where: { purchase: { trackId: id } },
        });
        await tx.musicPurchase.deleteMany({ where: { trackId: id } });
        await tx.download.deleteMany({ where: { trackId: id } });
        await tx.track.delete({ where: { id } });
        await tx.auditLog.create({
          data: audit(user.id, "TRACK_REMOVED", "Track", id),
        });
      });
      return Response.json({ ok: true, message: "Track permanently deleted." });
    }
    if (resource === "users") {
      await db.$transaction(async (tx) => {
        const target = await tx.user.findUnique({
          where: { id },
          include: {
            _count: { select: { submissions: true, collections: true } },
          },
        });
        if (!target) throw new HttpError(404, "User not found.");
        if (target.id === user.id)
          throw new HttpError(400, "You cannot delete your own account.");
        if (user.role !== "SUPER_ADMIN" && target.role === "SUPER_ADMIN")
          throw new HttpError(
            403,
            "Only Super Admin can manage Super Admin accounts.",
          );
        if (target._count.submissions || target._count.collections)
          throw new HttpError(
            409,
            "Remove or reassign this user's submitted reports before deleting their account.",
          );
        await tx.user.delete({ where: { id } });
        await tx.auditLog.create({
          data: audit(user.id, "USER_REMOVED", "User", id, {
            role: target.role,
          }),
        });
      });
      return Response.json({
        ok: true,
        message: "User permanently deleted and sessions revoked.",
      });
    }
    if (resource === "constituencies") {
      await db.$transaction(async (tx) => {
        const constituency = await tx.constituency.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                users: true,
                members: true,
                submissions: true,
                collections: true,
              },
            },
          },
        });
        if (!constituency) throw new HttpError(404, "Constituency not found.");
        const linked =
          constituency._count.users +
          constituency._count.members +
          constituency._count.submissions +
          constituency._count.collections;
        if (linked)
          throw new HttpError(
            409,
            "Only empty constituencies can be removed. Reassign or remove linked records first.",
          );
        await tx.constituency.delete({ where: { id } });
        await tx.auditLog.create({
          data: audit(user.id, "CONSTITUENCY_REMOVED", "Constituency", id),
        });
      });
      return Response.json({ ok: true, message: "Constituency removed." });
    }
    if (contentKinds.includes(resource)) {
      await db.$transaction(async (tx) => {
        const existing = await tx.content.findFirst({
          where: { id, ...(resource !== "content" ? { kind: resource } : {}) },
        });
        if (!existing) throw new HttpError(404, "Content not found.");
        await tx.content.delete({ where: { id } });
        await tx.auditLog.create({
          data: audit(user.id, "CONTENT_REMOVED", "Content", id, {
            kind: existing.kind,
          }),
        });
      });
      return Response.json({ ok: true, message: "Content removed." });
    }
    throw new HttpError(405, "This resource cannot be removed here.");
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    sameOrigin(request);
    const resource = (await context.params).resource,
      user = await access(resource, true);
    if (resource !== "users")
      throw new HttpError(405, "This resource does not support this action.");
    const { id, disabled } = z
      .object({ id: z.string().min(1), disabled: z.boolean() })
      .parse(await request.json());
    await db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) throw new HttpError(404, "User not found.");
      if (target.id === user.id)
        throw new HttpError(400, "You cannot change your own account here.");
      if (user.role !== "SUPER_ADMIN" && target.role === "SUPER_ADMIN")
        throw new HttpError(
          403,
          "Only Super Admin can manage Super Admin accounts.",
        );
      await tx.user.update({ where: { id }, data: { disabled } });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: audit(
          user.id,
          disabled ? "USER_DISABLED" : "USER_ENABLED",
          "User",
          id,
          { role: target.role },
        ),
      });
    });
    return Response.json({
      ok: true,
      message: disabled
        ? "User disabled and sessions revoked."
        : "User enabled. They can sign in again.",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
