import { test, expect, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const base = process.env.APP_URL || "http://127.0.0.1:3000";
const marker = `UI-${randomUUID().slice(0, 8)}`;
const entityIds: string[] = [];
let targetUserId = "";
let memberId = "";
let cookies: Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>;

test.use({ baseURL: base, browserName: "chromium", channel: "chrome" });
test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  expect(process.env.DEMO_MODE).toBe("true");
  await mkdir(".demo/ui-checks", { recursive: true });
  const login = await request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: {
      email: "admin@demo.invalid",
      password: process.env.DEMO_SEED_PASSWORD,
    },
  });
  expect(login.status()).toBe(200);
  cookies = (await request.storageState()).cookies;
  const constituency = await db.constituency.findUniqueOrThrow({ where: { code: "DEMO-A" } });
  const secretary = await db.user.findUniqueOrThrow({ where: { email: "secretary-a@demo.invalid" } });
  const member = await db.member.create({
    data: {
      constituencyId: constituency.id,
      memberNumber: marker,
      firstName: marker,
      lastName: "Member",
    },
  });
  memberId = member.id;
  entityIds.push(member.id);
  const target = await db.user.create({
    data: { id: randomUUID(), name: `${marker} User`, email: `${marker.toLowerCase()}@demo.invalid`, role: "EDITOR" },
  });
  targetUserId = target.id;
  entityIds.push(target.id);
  for (const kind of ["events", "media", "documents"]) {
    const record = await db.content.create({
      data: { kind, title: `${marker} ${kind}`, summary: "Temporary UI check", body: "Temporary record for UI verification." },
    });
    entityIds.push(record.id);
  }
  const track = await db.track.create({
    data: {
      slug: marker.toLowerCase(), title: `${marker} Track`, artist: "UI check",
      description: "Temporary track", audioStorageKey: "audio/demo-1.wav",
      previewUrl: "/preview-1.wav", price: 0, archived: true,
      downloads: { create: {} },
    },
  });
  entityIds.push(track.id);
  const emptyConstituency = await db.constituency.create({ data: { name: `${marker} Constituency`, code: `DEMO-${marker}` } });
  entityIds.push(emptyConstituency.id);
  const submission = await db.membershipSubmission.create({
    data: { constituencyId: constituency.id, submittedById: secretary.id, reportingPeriod: marker, memberCount: 0, snapshot: [] },
  });
  entityIds.push(submission.id);
  const collection = await db.collectionReport.create({
    data: {
      constituencyId: constituency.id, submittedById: secretary.id, reportingPeriod: marker,
      expectedAmount: 12, reportedAmount: 12, paymentReference: marker,
    },
  });
  entityIds.push(collection.id);
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(cookies);
});

test.afterAll(async () => {
  const content = await db.content.findMany({ where: { title: { startsWith: marker } }, select: { id: true } });
  entityIds.push(...content.map((record) => record.id));
  const where = { id: { in: entityIds } };
  await db.auditLog.deleteMany({ where: { OR: [{ entityId: { in: entityIds } }, { actorUserId: targetUserId }] } });
  await db.content.deleteMany({ where });
  await db.download.deleteMany({ where: { trackId: { in: entityIds } } });
  await db.track.deleteMany({ where });
  await db.member.deleteMany({ where });
  await db.membershipSubmission.deleteMany({ where });
  await db.collectionReport.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.constituency.deleteMany({ where });
  await db.$disconnect();
});

test("record actions remain visible on desktop, tablet and mobile", async ({ page }) => {
  test.setTimeout(90000);
  for (const viewport of [
    { width: 1440, height: 960, name: "desktop" },
    { width: 900, height: 900, name: "tablet" },
    { width: 390, height: 844, name: "mobile" },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/news");
    await expect(page).toHaveURL(`${base}/admin/events`);
    for (const section of ["users", "events", "media", "documents", "music", "constituencies"]) {
      await page.goto(`/admin/${section}`);
      for (const removed of ["content", "news", "collections", "payments", "audit", "membership"])
        await expect(page.locator(`.sidebar a[href='/admin/${removed}']`)).toHaveCount(0);
      await expect(page.locator(".sidebar a[href='/admin/events']")).toHaveCount(1);
      const row = page.locator("tbody tr").filter({ hasText: marker }).first();
      const button = row.getByRole("button", { name: "Remove", exact: true });
      await expect(button).toBeVisible();
      await button.scrollIntoViewIfNeeded();
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(await button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      })).toBeTruthy();
      if (["users", "events"].includes(section))
        await page.screenshot({ path: `.demo/ui-checks/${section}-${viewport.name}.png`, fullPage: true });
    }
  }
});

test("event creation, editing and removal work alongside account actions", async ({ page }) => {
  const eventTitle = `${marker} Created event`;
  const editedTitle = `${marker} Edited event`;
  await page.goto("/admin/events");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "New event", exact: true });
  await dialog.getByLabel("Title", { exact: true }).fill(eventTitle);
  await dialog.getByLabel("Summary", { exact: true }).fill("Temporary event check");
  await dialog.getByLabel("Content", { exact: true }).fill("Temporary event created during browser verification.");
  await dialog.getByLabel("Event date", { exact: true }).fill("2026-10-15T10:00");
  await dialog.getByLabel("Upload file (PDF, max 10 MB)", { exact: true }).setInputFiles({
    name: "event-file.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nTemporary event upload\n%%EOF"),
  });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  let row = page.locator("tbody tr").filter({ hasText: eventTitle });
  await expect(row).toBeVisible();
  const created = await db.content.findFirstOrThrow({ where: { title: eventTitle } });
  expect(created.kind).toBe("events");
  expect(created.eventDate).not.toBeNull();
  expect(created.storageKey).toMatch(/^document\//);
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit event", exact: true });
  await expect(dialog.getByLabel("Event date", { exact: true })).toHaveValue("2026-10-15T10:00");
  await expect(dialog.getByText("Existing file will be kept unless a new one is selected.")).toBeVisible();
  await dialog.getByLabel("Title", { exact: true }).fill(editedTitle);
  await dialog.getByLabel("Event date", { exact: true }).fill("2026-10-16T11:30");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  row = page.locator("tbody tr").filter({ hasText: editedTitle });
  await expect(row).toBeVisible();
  const updated = await db.content.findUniqueOrThrow({ where: { id: created.id } });
  expect(updated.eventDate?.toISOString()).toBe(new Date("2026-10-16T11:30").toISOString());
  expect(updated.storageKey).toBe(created.storageKey);
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(row).toHaveCount(0);

  await page.goto("/admin/users");
  row = page.locator("tbody tr").filter({ hasText: `${marker} User` });
  await row.getByRole("button", { name: "Disable", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Disable user", exact: true }).click();
  await expect(row.getByRole("button", { name: "Enable", exact: true })).toBeVisible();
  expect((await db.user.findUniqueOrThrow({ where: { id: targetUserId } })).disabled).toBe(true);
  await row.getByRole("button", { name: "Enable", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enable user", exact: true }).click();
  await expect(row.getByRole("button", { name: "Disable", exact: true })).toBeVisible();
  expect((await db.user.findUniqueOrThrow({ where: { id: targetUserId } })).disabled).toBe(false);
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Remove user", exact: true });
  await expect(dialog).toContainText("permanently deletes the account");
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(row).toHaveCount(0);
  expect(await db.user.findUnique({ where: { id: targetUserId } })).toBeNull();
  await page.reload();
  await expect(row).toHaveCount(0);
});

test("permanent removal works for content, archived music and empty constituencies", async ({ page }) => {
  for (const section of ["events", "media", "documents", "music", "constituencies"]) {
    await page.goto(`/admin/${section}`);
    const row = page.locator("tbody tr").filter({ hasText: marker });
    await expect(row).toBeVisible();
    if (section === "music") await expect(row).toContainText("ARCHIVED");
    await row.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("permanently deletes");
    await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.reload();
    await expect(row).toHaveCount(0);
    if (section === "music") {
      expect(await db.track.count({ where: { title: { startsWith: marker } } })).toBe(0);
      expect(await db.download.count({ where: { trackId: { in: entityIds } } })).toBe(0);
    } else if (section === "constituencies") {
      expect(await db.constituency.count({ where: { name: { startsWith: marker } } })).toBe(0);
    } else {
      expect(await db.content.count({ where: { kind: section, title: { startsWith: marker } } })).toBe(0);
    }
  }
});

test("constituency membership and report actions remain available in the portal", async ({ page }) => {
  const login = await page.context().request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: {
      email: "secretary-a@demo.invalid",
      password: process.env.DEMO_SEED_PASSWORD,
    },
  });
  expect(login.status()).toBe(200);
  await page.goto("/portal/membership");
  let row = page.locator("tbody tr").filter({ hasText: marker });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("dialog").getByLabel("First name", { exact: true }).fill(`${marker} Edited`);
  await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(row).toContainText(`${marker} Edited`);
  expect((await db.member.findUniqueOrThrow({ where: { id: memberId } })).firstName).toBe(`${marker} Edited`);
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(row).toHaveCount(0);

  await page.goto("/portal/history");
  row = page.locator("tbody tr").filter({ hasText: marker });
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(row).toHaveCount(0);

  await page.goto("/portal/collections");
  row = page.locator("tbody tr").filter({ hasText: marker });
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(row).toHaveCount(0);
});
