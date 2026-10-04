import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

loadEnvConfig(process.cwd());
const base = process.env.APP_URL || "http://127.0.0.1:3000";
const marker = `FORM-${randomUUID().slice(0, 8)}`;
const db = new PrismaClient();
test.use({ baseURL: base, browserName: "chromium", channel: "chrome", launchOptions: { args: ["--disable-gpu"] } });
test.describe.configure({ mode: "serial", timeout: 90000 });

test.afterAll(async () => {
  const submissions = await db.membershipSubmission.findMany({ where: { reportingPeriod: marker }, select: { id: true } });
  const members = await db.member.findMany({ where: { memberNumber: marker }, select: { id: true } });
  await db.auditLog.deleteMany({ where: { entityId: { in: [...submissions, ...members].map((row) => row.id) } } });
  await db.membershipSubmission.deleteMany({ where: { reportingPeriod: marker } });
  await db.member.deleteMany({ where: { memberNumber: marker } });
  await db.$disconnect();
});

test("required membership fields fit on desktop and mobile, and submitting downloads the landscape form", async ({ page }) => {
  test.setTimeout(90000);
  expect(process.env.DEMO_MODE).toBe("true");
  await mkdir(".demo/ui-checks", { recursive: true });
  const login = await page.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: { email: "secretary-a@demo.invalid", password: process.env.DEMO_SEED_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 960, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
    await page.setViewportSize(viewport);
    await page.goto("/portal/membership");
    await expect(page.getByRole("columnheader", { name: "Member number", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Import CSV" })).toHaveCount(0);
    await page.getByRole("button", { name: "Add member", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New member", exact: true });
    for (const field of ["firstName", "lastName", "gender", "idNumber", "village", "memberNumber", "phone"]) {
      await expect(dialog.locator(`[name='${field}']`)).toHaveAttribute("required", "");
    }
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `.demo/ui-checks/member-form-${viewport.name}.png` });
    if (viewport.name === "desktop") {
      await dialog.getByLabel("First name (Lebitso)", { exact: true }).fill(marker);
      await dialog.getByLabel("Surname (Fane)", { exact: true }).fill("Fictional");
      await dialog.getByLabel("Sex (M/F)").selectOption("F");
      await dialog.getByLabel("ID or IEC number", { exact: true }).fill("DEMO-IEC-FORM");
      await dialog.getByLabel("Village (Motse)", { exact: true }).fill("Fictional village");
      await dialog.getByLabel("Membership-card number", { exact: true }).fill(marker);
      await dialog.getByLabel("Phone (Mohala)", { exact: true }).fill("+266 5000 0000");
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator("tbody tr").filter({ hasText: marker })).toBeVisible();
    } else await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  }
  await page.goto("/portal/submit");
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Submit membership report", exact: true });
  await expect(dialog.getByLabel("Constituency (Lebatooa)")).toHaveValue("Demonstration Constituency A");
  await dialog.getByLabel("Branch (Lekala)").fill("Fictional branch");
  await dialog.getByLabel("District (Setereke)").fill("Fictional district");
  await dialog.getByLabel("Reporting period", { exact: true }).fill(marker);
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Submit report", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await download.saveAs(".demo/ui-checks/submitted-membership-form.pdf");
  await page.goto("/portal/history");
  const row = page.locator("tbody tr").filter({ hasText: marker });
  await expect(row).toBeVisible();
  await expect(row.getByRole("link", { name: /Download membership form PDF/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("constituency creation requires constituency, number, and district", async ({ page }) => {
  const login = await page.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: { email: "admin@demo.invalid", password: process.env.DEMO_SEED_PASSWORD },
  });
  expect(login.status()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/constituencies");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New constituency", exact: true });
  for (const label of ["Constituency (Lebatooa)", "Constituency number", "District (Setereke)"]) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveAttribute("required", "");
  }
  await expect(dialog.getByLabel("Branch (Lekala)", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: ".demo/ui-checks/constituency-form-mobile.png" });
});

test("voter registration lookup is public and fits beside the home actions", async ({ page, context }) => {
  await mkdir(".demo/ui-checks", { recursive: true });
  for (const viewport of [
    { width: 1440, height: 960, name: "desktop" },
    { width: 390, height: 844, name: "mobile" },
    { width: 320, height: 740, name: "small-mobile" },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const actions = page.locator(".hero-actions");
    await expect(actions.getByRole("link", { name: "Read the Manifesto", exact: true })).toBeVisible();
    const link = actions.getByRole("link", { name: "Check Voter Registration", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://selfreg.iec.org.ls/");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
    const bounds = await link.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(await link.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `.demo/ui-checks/home-iec-${viewport.name}.png` });
  }
  await context.route("https://selfreg.iec.org.ls/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>IEC test destination</title>" }));
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "Check Voter Registration", exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  expect(popup.url()).toBe("https://selfreg.iec.org.ls/");
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await popup.close();
});
