import type { Role } from "@prisma/client";
export const permissions = [
  "MANAGE_USERS",
  "MANAGE_CONTENT",
  "MANAGE_MEDIA",
  "MANAGE_MUSIC",
  "VIEW_FINANCE",
  "VERIFY_PAYMENTS",
  "MANAGE_CONSTITUENCIES",
  "VIEW_ALL_MEMBERSHIP",
  "REVIEW_MEMBERSHIP",
  "SUBMIT_CONSTITUENCY_MEMBERSHIP",
  "SUBMIT_COLLECTION_REPORT",
  "VIEW_AUDIT_LOG",
] as const;
export type Permission = (typeof permissions)[number];
const grants: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: permissions,
  ADMIN: [
    "MANAGE_USERS",
    "MANAGE_CONTENT",
    "MANAGE_MEDIA",
    "MANAGE_MUSIC",
    "VIEW_FINANCE",
    "VERIFY_PAYMENTS",
    "MANAGE_CONSTITUENCIES",
    "VIEW_ALL_MEMBERSHIP",
    "REVIEW_MEMBERSHIP",
    "VIEW_AUDIT_LOG",
  ],
  FINANCE_OFFICER: ["VIEW_FINANCE", "VERIFY_PAYMENTS"],
  MEDIA_MANAGER: ["MANAGE_MEDIA", "MANAGE_MUSIC"],
  EDITOR: ["MANAGE_CONTENT"],
  SECRETARY_GENERAL: [
    "SUBMIT_CONSTITUENCY_MEMBERSHIP",
    "SUBMIT_COLLECTION_REPORT",
  ],
  AUDITOR: ["VIEW_FINANCE", "VIEW_AUDIT_LOG"],
};
export function can(role: Role, permission: Permission) {
  return grants[role]?.includes(permission) ?? false;
}
export function scopeFor(user: {
  role: Role;
  assignedConstituencyId: string | null;
}) {
  if (user.role !== "SECRETARY_GENERAL" || !user.assignedConstituencyId)
    throw new Error("An assigned constituency is required.");
  return { constituencyId: user.assignedConstituencyId };
}
export const sections = [
  { key: "dashboard", label: "Overview", permission: null },
  { key: "events", label: "Events", permission: "MANAGE_CONTENT" },
  { key: "media", label: "Media", permission: "MANAGE_MEDIA" },
  { key: "music", label: "Music", permission: "MANAGE_MUSIC" },
  { key: "documents", label: "Documents", permission: "MANAGE_CONTENT" },
  {
    key: "constituencies",
    label: "Constituencies",
    permission: "MANAGE_CONSTITUENCIES",
  },
  { key: "reports", label: "Reports", permission: "VIEW_FINANCE" },
  { key: "users", label: "Users", permission: "MANAGE_USERS" },
] satisfies { key: string; label: string; permission: Permission | null }[];
