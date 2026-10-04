import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

loadEnvConfig(process.cwd());
const base = process.env.APP_URL || "http://127.0.0.1:3000";
const marker = `MANIFESTO-${randomUUID().slice(0, 8)}`;
const db = new PrismaClient();
test.use({ baseURL: base, browserName: "chromium", channel: "chrome" });
test.describe.configure({ mode: "serial", timeout: 90000 });

test.afterAll(async () => {
  const records = await db.content.findMany({ where: { title: marker }, select: { id: true, storageKey: true } });
  await db.auditLog.deleteMany({ where: { entityId: { in: records.map((record) => record.id) } } });
  await db.content.deleteMany({ where: { title: marker } });
  const workspace = resolve(process.cwd());
  const storageRoot = resolve(process.env.STORAGE_ROOT || "private-storage");
  for (const record of records) {
    if (!record.storageKey) continue;
    const path = resolve(storageRoot, record.storageKey);
    if (!storageRoot.startsWith(workspace + sep) || !path.startsWith(storageRoot + sep))
      throw new Error("Test attachment is outside the workspace.");
    await rm(path, { force: true });
  }
  await db.$disconnect();
});

test("manifesto publication and PDF access work on both public pages", async ({ page, browser }) => {
  expect(process.env.DEMO_MODE).toBe("true");
  expect(process.env.STORAGE_PROVIDER).not.toBe("vercel-blob");
  await mkdir(".demo/ui-checks", { recursive: true });
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  try {
    const login = await page.request.post(`${base}/api/auth/sign-in/email`, {
      headers: { Origin: base },
      data: { email: "admin@demo.invalid", password: process.env.DEMO_SEED_PASSWORD },
    });
    expect(login.status()).toBe(200);
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("Temporary manifesto attachment for UI verification.");
    await page.goto("/admin/manifesto");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const form = page.getByRole("dialog", { name: "New manifesto", exact: true });
    await form.getByLabel("Title", { exact: true }).fill(marker);
    await form.getByLabel("Summary", { exact: true }).fill("Temporary manifesto publication fixture.");
    await form.getByLabel("Manifesto text", { exact: true }).fill("Temporary reading fixture.\n\nThis content verifies publication without making policy claims.");
    await form.locator("input[name='attachment']").setInputFiles({
      name: "manifesto.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()),
    });
    await form.getByRole("button", { name: "Save", exact: true }).click();
    const row = page.locator("tbody tr").filter({ hasText: marker });
    await expect(row).toBeVisible();
    const record = await db.content.findFirstOrThrow({ where: { title: marker, kind: "manifesto" } });
    expect(record.storageKey).toBeTruthy();
    await publicPage.setViewportSize({ width: 390, height: 844 });
    await publicPage.goto(`${base}/about`);
    await expect(publicPage.getByRole("heading", { name: "The Manifesto", exact: true })).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: marker, exact: true })).toHaveCount(0);
    expect((await publicContext.request.get(`${base}/api/documents/${record.id}`)).status()).toBe(404);
    await publicPage.screenshot({ path: ".demo/ui-checks/about-manifesto-overview-mobile.png", fullPage: true });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Published", { exact: true }).check();
    await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(row).toContainText("PUBLISHED");
    for (const viewport of [
      { width: 1440, height: 960, name: "desktop" },
      { width: 390, height: 844, name: "mobile" },
    ]) {
      await publicPage.setViewportSize(viewport);
      await publicPage.goto(`${base}/about`);
      await expect(publicPage.getByRole("heading", { name: marker, exact: true })).toBeVisible();
      await expect(publicPage.locator(".manifesto-text")).toContainText("Temporary reading fixture.");
      expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await publicPage.content()).not.toContain(record.storageKey!);
      await publicPage.screenshot({ path: `.demo/ui-checks/about-manifesto-published-${viewport.name}.png`, fullPage: true });
    }
    const link = publicPage.getByRole("link", { name: "Download attachment", exact: true });
    const response = await publicContext.request.get(`${base}${await link.getAttribute("href")}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect((await PDFDocument.load(await response.body())).getPageCount()).toBe(1);
    await publicPage.goto(`${base}/manifesto`);
    await expect(publicPage.getByRole("heading", { name: marker, exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Published", { exact: true }).uncheck();
    await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(row).toContainText("DRAFT");
    await publicPage.reload();
    await expect(publicPage.getByRole("heading", { name: marker, exact: true })).toHaveCount(0);
    expect((await publicContext.request.get(`${base}/api/documents/${record.id}`)).status()).toBe(404);
  } finally {
    await publicContext.close();
  }
});
