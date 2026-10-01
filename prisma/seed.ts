import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../lib/db";
import type { Role } from "@prisma/client";
async function main() {
  if (process.env.DEMO_MODE !== "true")
    throw new Error("Seeding is permitted in demo mode only.");
  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("Set a demo-only password with at least 12 characters.");
  const a = await db.constituency.upsert({
    where: { code: "DEMO-A" },
    create: {
      name: "Demonstration Constituency A",
      code: "DEMO-A",
      district: "Fictional district",
    },
    update: {},
  });
  const b = await db.constituency.upsert({
    where: { code: "DEMO-B" },
    create: {
      name: "Demonstration Constituency B",
      code: "DEMO-B",
      district: "Fictional district",
    },
    update: {},
  });
  const users: [string, string, Role, string | null][] = [
    ["super", "Demo Super Admin", "SUPER_ADMIN", null],
    ["admin", "Demo Administrator", "ADMIN", null],
    ["media", "Demo Media Manager", "MEDIA_MANAGER", null],
    ["finance", "Demo Finance Officer", "FINANCE_OFFICER", null],
    ["editor", "Demo Editor", "EDITOR", null],
    ["secretary-a", "Demo Secretary A", "SECRETARY_GENERAL", a.id],
    ["secretary-b", "Demo Secretary B", "SECRETARY_GENERAL", b.id],
  ];
  for (const [local, name, role, assignedConstituencyId] of users) {
    const user = await db.user.upsert({
      where: { email: `${local}@demo.invalid` },
      create: {
        id: randomUUID(),
        name,
        email: `${local}@demo.invalid`,
        emailVerified: true,
        role,
        assignedConstituencyId,
      },
      update: {},
    });
    await db.account.upsert({
      where: {
        providerId_accountId: { providerId: "credential", accountId: user.id },
      },
      create: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: await hashPassword(password),
      },
      update: {},
    });
  }
  for (const c of [a, b])
    for (let i = 1; i <= 6; i++)
      await db.member.upsert({
        where: {
          constituencyId_memberNumber: {
            constituencyId: c.id,
            memberNumber: `${c.code}-${String(i).padStart(3, "0")}`,
          },
        },
        create: {
          constituencyId: c.id,
          memberNumber: `${c.code}-${String(i).padStart(3, "0")}`,
          firstName: `Demo Member ${i}`,
          lastName: c.code,
        },
        update: {},
      });
  const content = [
    {
      id: "demo-news-1",
      kind: "news",
      title: "A connected platform for every constituency",
      summary:
        "A demonstration of how party updates could reach members in one place.",
      body: "This sample article demonstrates the proposed publishing experience. It does not describe an actual AD announcement or achievement.",
      image: "/landscape.jpg",
    },
    {
      id: "demo-news-2",
      kind: "news",
      title: "Keeping members informed, wherever they are",
      summary: "A preview of a clear, accessible digital newsroom.",
      body: "Demonstration content for presentation purposes. Approved official articles can replace this example.",
      image: "/landscape.jpg",
    },
    {
      id: "demo-news-3",
      kind: "news",
      title: "A simpler way to connect and participate",
      summary: "Exploring the proposed membership and constituency experience.",
      body: "This is a sample announcement about the website proposal, not an official political statement.",
      image: "/ad-logo.png",
    },
    {
      id: "demo-event-1",
      kind: "events",
      title: "Digital platform presentation",
      summary: "Demonstration event. Date and venue are illustrative.",
      body: "Sample event only. No real public event is being announced.",
      eventDate: new Date("2026-11-12T09:00:00Z"),
    },
    {
      id: "demo-media-1",
      kind: "media",
      title: "Illustrative mountain landscape",
      summary:
        "Illustrative photography, not an AD event or a verified Lesotho location.",
      body: "Illustrative public media example.",
      image: "/landscape.jpg",
    },
    {
      id: "demo-doc-1",
      kind: "documents",
      title: "Digital platform proposal overview",
      summary: "Demonstration resource for the proposed platform.",
      body: "AD Digital Platform - Demonstration\n\nPublic website, administration, constituency membership, collections and demo music payments.\n\nThis is not an official manifesto or policy document.",
    },
  ];
  for (const item of content)
    await db.content.upsert({
      where: { id: item.id },
      create: { ...item, isPublished: false },
      update:
        item.id === "demo-media-1"
          ? { title: item.title, summary: item.summary }
          : {},
    });
  const secretary = await db.user.findUniqueOrThrow({
    where: { email: "secretary-a@demo.invalid" },
  });
  if (
    !(await db.membershipSubmission.findFirst({
      where: { submittedById: secretary.id },
    }))
  ) {
    const members = await db.member.findMany({
      where: { constituencyId: a.id },
      select: {
        memberNumber: true,
        firstName: true,
        lastName: true,
        membershipStatus: true,
      },
    });
    await db.membershipSubmission.create({
      data: {
        constituencyId: a.id,
        submittedById: secretary.id,
        reportingPeriod: "September 2026 (demo)",
        memberCount: members.length,
        snapshot: members,
        status: "SUBMITTED",
        notes: "Fictional demonstration records only.",
      },
    });
  }
  if (
    !(await db.collectionReport.findFirst({
      where: { paymentReference: "DEMO-COLLECTION-001" },
    }))
  )
    await db.collectionReport.create({
      data: {
        constituencyId: a.id,
        submittedById: secretary.id,
        reportingPeriod: "September 2026 (demo)",
        expectedAmount: 120,
        reportedAmount: 120,
        currency: process.env.STORE_CURRENCY || "LSL",
        paymentReference: "DEMO-COLLECTION-001",
        notes: "Fictional collection. No money transferred.",
      },
    });
  console.log("Fictional demo records ready. Credentials: .demo/accounts.txt");
}
main().finally(() => db.$disconnect());
