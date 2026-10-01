import { db } from "./db";
import { currentUser } from "./security";
import { can, sections, scopeFor } from "./permissions";
import { redirect, notFound } from "next/navigation";
import { cloudUploads } from "./storage";
export async function workspaceData(area: "admin" | "portal", section: string) {
  const user = await currentUser();
  if (!user) redirect("/portal/login");
  if (area === "admin" && user.role === "SECRETARY_GENERAL")
    redirect("/portal");
  if (area === "portal" && user.role !== "SECRETARY_GENERAL")
    redirect("/admin");
  if (area === "admin" && section === "news") redirect("/admin/events");
  if (
    area === "admin" &&
    ["content", "collections", "payments", "audit", "membership"].includes(section)
  )
    redirect("/admin");
  const allowed =
    area === "admin"
      ? sections.filter((s) => !s.permission || can(user.role, s.permission))
      : [
          { key: "dashboard", label: "Overview" },
          { key: "membership", label: "Membership" },
          { key: "submit", label: "Submit membership" },
          { key: "collections", label: "Collections" },
          { key: "history", label: "Submission history" },
          { key: "account", label: "Account" },
        ];
  if (!allowed.some((s) => s.key === section)) notFound();
  const metrics: { label: string; value: string; detail: string }[] = [];
  if (area === "portal") {
    const scope = scopeFor(user);
    const [members, submissions, pending, verified] = await Promise.all([
      db.member.count({ where: scope }),
      db.membershipSubmission.count({ where: scope }),
      db.collectionReport.count({
        where: { ...scope, status: "PENDING_VERIFICATION" },
      }),
      db.collectionReport.aggregate({
        where: { ...scope, status: "VERIFIED" },
        _sum: { verifiedAmount: true },
      }),
    ]);
    metrics.push(
      {
        label: "Registered members",
        value: String(members),
        detail: "Fictional records",
      },
      {
        label: "Membership submissions",
        value: String(submissions),
        detail: "Your constituency",
      },
      {
        label: "Pending collections",
        value: String(pending),
        detail: "Awaiting Finance review",
      },
      {
        label: "Verified collections",
        value: `${process.env.STORE_CURRENCY || "LSL"} ${verified._sum.verifiedAmount || "0"}`,
        detail: "Simulated amounts",
      },
    );
  } else {
    if (can(user.role, "MANAGE_CONTENT"))
      metrics.push(
        {
          label: "Upcoming events",
          value: String(
            await db.content.count({
              where: {
                kind: "events",
                isPublished: true,
                eventDate: { gte: new Date() },
              },
            }),
          ),
          detail: "Published events",
        },
      );
    if (can(user.role, "MANAGE_MUSIC"))
      metrics.push(
        {
          label: "Published tracks",
          value: String(
            await db.track.count({
              where: { isPublished: true, archived: false },
            }),
          ),
          detail: "Published audio",
        },
        {
          label: "Music downloads",
          value: String(await db.download.count()),
          detail: "Recorded downloads",
        },
      );
    if (can(user.role, "VIEW_FINANCE"))
      metrics.push(
        {
          label: "Reports",
          value: String(await db.collectionReport.count()),
          detail: "Finance reports",
        },
      );
    if (can(user.role, "MANAGE_CONSTITUENCIES"))
      metrics.push(
        {
          label: "Constituencies",
          value: String(await db.constituency.count()),
          detail: "Fictional areas",
        },
      );
  }
  const constituencies = can(user.role, "MANAGE_USERS")
    ? await db.constituency.findMany({ select: { id: true, name: true } })
    : [];
  return {
    area,
    section,
    cloudUploads,
    currency: process.env.STORE_CURRENCY || "LSL",
    nav: allowed.map(({ key, label }) => ({ key, label })),
    metrics,
    constituencies,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedConstituencyId: user.assignedConstituencyId,
      constituency: user.assignedConstituency?.name || null,
    },
    canVerify: can(user.role, "VERIFY_PAYMENTS"),
    canReview: can(user.role, "REVIEW_MEMBERSHIP"),
  };
}
export type WorkspaceData = Awaited<ReturnType<typeof workspaceData>>;
