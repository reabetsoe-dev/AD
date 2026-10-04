import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

loadEnvConfig(process.cwd());
const base = process.env.APP_URL || "http://127.0.0.1:3000";
const marker = `MEDIA-${randomUUID().slice(0, 8)}`;
const db = new PrismaClient();
const uploadedKeys = new Set<string>();
const restrictedUserId = randomUUID();
test.use({ baseURL: base, browserName: "chromium", channel: "chrome" });
test.describe.configure({ mode: "serial", timeout: 180000 });

test.afterAll(async () => {
  const records = await db.content.findMany({ where: { title: { startsWith: marker } } });
  records.forEach((record) => { if (record.storageKey) uploadedKeys.add(record.storageKey); });
  await db.auditLog.deleteMany({ where: { entityId: { in: records.map((record) => record.id) } } });
  await db.content.deleteMany({ where: { title: { startsWith: marker } } });
  await db.auditLog.deleteMany({ where: { actorUserId: restrictedUserId } });
  await db.user.deleteMany({ where: { id: restrictedUserId } });
  const workspace = resolve(process.cwd());
  const root = resolve(process.env.STORAGE_ROOT || "private-storage");
  for (const key of uploadedKeys) {
    const path = resolve(root, key);
    if (!root.startsWith(workspace + sep) || !path.startsWith(root + sep))
      throw new Error("Media test attachment is outside the workspace.");
    await rm(path, { force: true });
  }
  await db.$disconnect();
});

test("admin uploads and links populate every public media tab", async ({ page, browser }) => {
  page.setDefaultTimeout(10000);
  expect(process.env.DEMO_MODE).toBe("true");
  expect(process.env.STORAGE_PROVIDER).not.toBe("vercel-blob");
  await mkdir(".demo/ui-checks", { recursive: true });
  const login = await page.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: { email: "admin@demo.invalid", password: process.env.DEMO_SEED_PASSWORD },
  });
  expect(login.status()).toBe(200);
  await page.goto("/admin/media");
  await expect(page.locator(".table-wrap")).toHaveAttribute("aria-busy", "false");

  const video = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    const completed = new Promise<void>((done) => { recorder.onstop = () => done(); });
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    for (let frame = 0; frame < 10; frame++) {
      ctx.fillStyle = "#e50023";
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(frame * 20, 60, 50, 60);
      await new Promise((done) => setTimeout(done, 100));
    }
    recorder.stop();
    await completed;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer()));
  });
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Temporary media press document.");
  const samples = [
    { category: "Photos", type: "photos", name: "photo.png", mimeType: "image/png", buffer: await readFile("public/ad-logo.png"), link: `${base}/ad-logo.png?media-test=1` },
    { category: "Videos", type: "videos", name: "video.webm", mimeType: "video/webm", buffer: Buffer.from(video), link: "https://www.youtube.com/watch?v=media-test" },
    { category: "Speeches", type: "speeches", name: "speech.wav", mimeType: "audio/wav", buffer: await readFile("public/preview-1.wav"), link: "https://example.com/speeches/test" },
    { category: "Press", type: "press", name: "press.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()), link: "https://example.com/press/test" },
  ];
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  try {
    for (const sample of samples) {
      const title = `${marker} ${sample.category} file`;
      await page.getByRole("button", { name: "Create", exact: true }).click();
      const form = page.getByRole("dialog", { name: "New media", exact: true });
      await expect(form).toBeVisible();
      await form.getByLabel("Category").selectOption(sample.type);
      await form.getByLabel("Title", { exact: true }).fill(title);
      await form.getByLabel("Summary", { exact: true }).fill("Temporary media publication fixture.");
      await form.getByLabel("Upload file", { exact: true }).setInputFiles({ name: sample.name, mimeType: sample.mimeType, buffer: sample.buffer });
      await form.getByRole("button", { name: "Save", exact: true }).click();
      const row = page.locator("tbody tr").filter({ hasText: title });
      await expect(row).toContainText("DRAFT");
      const record = await db.content.findFirstOrThrow({ where: { title, kind: "media" } });
      uploadedKeys.add(record.storageKey!);
      expect(record.mediaCategory).toBe(sample.type);
      expect((await publicContext.request.get(`${base}/api/documents/${record.id}`)).status()).toBe(404);
      await publicPage.goto(`${base}/media`);
      await expect(publicPage.getByRole("button", { name: `View ${title}`, exact: true })).toHaveCount(0);
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByRole("dialog").getByLabel("Published", { exact: true }).check();
      await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(row).toContainText("PUBLISHED");
      await publicPage.reload();
      await publicPage.getByRole("button", { name: sample.category, exact: true }).click();
      await publicPage.getByRole("button", { name: `View ${title}`, exact: true }).click();
      const detail = publicPage.getByRole("dialog", { name: title, exact: true });
      if (sample.type === "photos") {
        await expect(detail.locator("img")).toBeVisible();
        await expect.poll(() => detail.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      } else if (sample.type === "videos" || sample.type === "speeches") {
        const player = detail.locator(sample.type === "videos" ? "video" : "audio");
        await expect(player).toHaveAttribute("controls", "");
        await expect.poll(() => player.evaluate((element: HTMLMediaElement) => element.readyState)).toBeGreaterThanOrEqual(1);
      } else {
        await expect(detail.getByRole("link", { name: "Open document" })).toBeVisible();
      }
      const download = await publicContext.request.get(`${base}/api/documents/${record.id}`);
      expect(download.status()).toBe(200);
      expect(download.headers()["content-type"]).toBe(sample.mimeType);
      expect(await download.body()).toEqual(sample.buffer);
      await detail.getByRole("button", { name: "Close dialog" }).click();

      await page.getByRole("button", { name: "Create", exact: true }).click();
      const linkForm = page.getByRole("dialog", { name: "New media", exact: true });
      await linkForm.getByLabel("Category").selectOption(sample.type);
      await linkForm.getByLabel("Title", { exact: true }).fill(`${marker} ${sample.category} link`);
      await linkForm.getByLabel("Summary", { exact: true }).fill("Temporary linked media fixture.");
      await linkForm.getByRole("radio", { name: "Link", exact: true }).check();
      await linkForm.getByLabel("Media link", { exact: true }).fill(sample.link);
      await linkForm.getByLabel("Published", { exact: true }).check();
      await linkForm.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator("tbody tr").filter({ hasText: `${marker} ${sample.category} link` })).toContainText("PUBLISHED");
    }
    for (const viewport of [{ width: 1440, height: 960, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
      await publicPage.setViewportSize(viewport);
      await publicPage.goto(`${base}/media`);
      await expect(publicPage.locator(".media-item").filter({ hasText: marker })).toHaveCount(8);
      expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await publicPage.screenshot({ path: `.demo/ui-checks/media-${viewport.name}.png`, fullPage: true });
      for (const sample of samples) {
        await publicPage.getByRole("button", { name: sample.category, exact: true }).click();
        await expect(publicPage.locator(".media-item").filter({ hasText: marker })).toHaveCount(2);
        await publicPage.getByRole("button", { name: `View ${marker} ${sample.category} link`, exact: true }).click();
        const detail = publicPage.getByRole("dialog");
        await expect(detail.getByRole("link", { name: "Open link", exact: true })).toHaveAttribute("href", sample.link);
        expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await detail.getByRole("button", { name: "Close dialog" }).click();
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("dialog").getByRole("radio", { name: "Link", exact: true }).check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: ".demo/ui-checks/media-admin-mobile.png", fullPage: true });
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await page.screenshot({ path: ".demo/ui-checks/media-admin-current.png", fullPage: true }).catch(() => {});
    await publicContext.close();
  }
});

test("media writes enforce authorization, validate sources, and support replacing or unpublishing media", async ({ request }) => {
  const login = await request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: { email: "admin@demo.invalid", password: process.env.DEMO_SEED_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const record = await db.content.findFirstOrThrow({ where: { title: `${marker} Photos file` } });
  const data = { id: record.id, title: record.title, summary: record.summary, body: record.body, isPublished: true, mediaCategory: "photos", mediaSource: "link", externalUrl: `${base}/ad-logo.png` };
  for (const externalUrl of ["javascript:alert(1)", "file:///test", "https://user:pass@example.com", "bad-url"]) {
    expect((await request.post("/api/internal/media", { headers: { Origin: base }, data: { ...data, externalUrl } })).status()).toBe(400);
  }
  expect((await request.post("/api/internal/media", { headers: { Origin: "https://example.com" }, data })).status()).toBe(403);
  expect((await request.post("/api/internal/media", { headers: { Origin: base }, data: { ...data, mediaSource: "file", mediaCategory: "videos" } })).status()).toBe(400);
  expect((await request.post("/api/internal/media", { headers: { Origin: base }, data })).status()).toBe(200);
  expect((await db.content.findUniqueOrThrow({ where: { id: record.id } })).storageKey).toBeNull();
  const photo = await readFile("public/ad-logo.png");
  expect((await request.post("/api/internal/media", {
    headers: { Origin: base },
    multipart: { ...data, isPublished: "true", mediaSource: "file", attachment: { name: "replacement.png", mimeType: "image/png", buffer: photo } },
  })).status()).toBe(200);
  const replaced = await db.content.findUniqueOrThrow({ where: { id: record.id } });
  uploadedKeys.add(replaced.storageKey!);
  expect(replaced.externalUrl).toBeNull();
  expect(replaced.storageKey).toBeTruthy();
  expect((await request.post("/api/internal/media", { headers: { Origin: base }, data: { ...data, isPublished: false } })).status()).toBe(200);
  expect((await request.get(`/api/documents/${record.id}`)).status()).toBe(404);
  const restrictedPassword = randomUUID();
  const restrictedEmail = `${marker.toLowerCase()}@demo.invalid`;
  await db.user.create({
    data: {
      id: restrictedUserId, name: "Temporary media access fixture", email: restrictedEmail,
      emailVerified: true, role: "FINANCE_OFFICER",
      accounts: { create: { id: randomUUID(), accountId: restrictedUserId, providerId: "credential", password: await hashPassword(restrictedPassword) } },
    },
  });
  const restricted = await request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: { email: restrictedEmail, password: restrictedPassword },
  });
  expect(restricted.status()).toBe(200);
  expect((await request.post("/api/internal/media", { headers: { Origin: base }, data })).status()).toBe(403);
});
