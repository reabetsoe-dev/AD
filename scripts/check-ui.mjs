import { chromium } from "@playwright/test";
import nextEnv from "@next/env";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.APP_URL || "http://127.0.0.1:3000";
mkdirSync(".demo/screenshots", { recursive: true });
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : undefined,
  headless: true,
});
const errors = [];
async function makePage(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
async function check(page, path, screenshot) {
  const response = await page.goto(`${base}${path}`, {
    waitUntil: "networkidle",
  });
  assert.equal(response.status(), 200, path);
  const details = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    brokenImages: [...document.images]
      .filter((i) => !i.complete || !i.naturalWidth)
      .map((i) => i.src),
    title: document.querySelector("h1")?.textContent,
  }));
  if (screenshot)
    await page.screenshot({
      path: `.demo/screenshots/${screenshot}.png`,
      fullPage: true,
    });
  if (details.overflow)
    console.log(
      await page.evaluate(() => ({
        body: document.body.scrollWidth,
        html: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        items: [...document.body.children].map((e) => ({
          tag: e.tagName,
          class: e.className,
          width: e.getBoundingClientRect().width,
          left: e.getBoundingClientRect().left,
          right: e.getBoundingClientRect().right,
          scroll: e.scrollWidth,
        })),
        over: [...document.querySelectorAll("body *")]
          .filter(
            (e) =>
              e.getBoundingClientRect().right > window.innerWidth &&
              !e.closest(".table-wrap"),
          )
          .map((e) => ({
            tag: e.tagName,
            class: e.className,
            right: e.getBoundingClientRect().right,
            position: getComputedStyle(e).position,
          }))
          .slice(0, 20),
      })),
    );
  assert.equal(details.overflow, false, `${path}: horizontal overflow`);
  assert.deepEqual(details.brokenImages, [], `${path}: broken image`);
  console.log(`PASS ${path}: ${details.title}`);
}
async function login(page, email) {
  await page.goto(`${base}/portal/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(admin|portal)$/);
  await page.waitForLoadState("networkidle");
}
try {
  const desktop = await makePage(1440, 950),
    phone = await makePage(390, 844),
    small = await makePage(320, 740);
  if (!process.argv.includes("portal")) {
    await check(desktop.page, "/", "home-desktop");
    await check(phone.page, "/", "home-mobile");
    await phone.page.getByRole("button", { name: "Open navigation" }).click();
    await phone.page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Music", exact: true })
      .click();
    await phone.page.waitForURL(`${base}/music`);
    await desktop.page.getByRole("button", { name: "ST", exact: true }).click();
    await desktop.page
      .getByRole("heading", { name: "Litaba tsa morao-rao", exact: true })
      .waitFor();
    assert.equal(await desktop.page.locator("html").getAttribute("lang"), "st");
    await desktop.page.getByRole("button", { name: "EN", exact: true }).click();
    for (const route of [
      "/about",
      "/leadership",
      "/policies",
      "/manifesto",
      "/candidates",
      "/news",
      "/events",
      "/media",
      "/music",
      "/documents",
      "/contact",
      "/portal/login",
    ]) {
      await check(
        desktop.page,
        route,
        route === "/music" ? "music-desktop" : undefined,
      );
      await check(
        phone.page,
        route,
        route === "/music" ? "music-mobile" : undefined,
      );
    }
    await desktop.page.goto(`${base}/media`, { waitUntil: "networkidle" });
    if (await desktop.page.locator(".media-item").count()) {
      await desktop.page.locator(".media-item").first().click();
      await desktop.page.getByRole("dialog").waitFor();
      await desktop.page.keyboard.press("Escape");
      assert.equal(await desktop.page.getByRole("dialog").count(), 0);
    } else {
      await desktop.page
        .getByRole("heading", { name: "Updates coming soon" })
        .waitFor();
    }
    await desktop.page.goto(`${base}/music`, { waitUntil: "networkidle" });
    assert.equal(
      await desktop.page.locator("audio").evaluate((a) => a.paused),
      true,
    );
    if (await desktop.page.locator(".track-card").count()) {
      await desktop.page
        .getByRole("button", { name: /Play preview:/ })
        .first()
        .click();
      await desktop.page.waitForFunction(
        () => document.querySelector("audio")?.currentTime > 0,
      );
      await desktop.page
        .getByRole("button", { name: "Pause", exact: true })
        .click();
      await desktop.page.getByRole("button", { name: "Close player" }).click();
      await desktop.page
        .getByRole("button", { name: "Buy track", exact: true })
        .first()
        .click();
      await desktop.page
        .getByRole("button", { name: "Start simulated M-Pesa payment" })
        .click();
      await desktop.page
        .getByRole("button", { name: "Simulate successful payment" })
        .click();
      await desktop.page
        .getByRole("heading", { name: "Simulated payment confirmed" })
        .waitFor();
      const [download] = await Promise.all([
        desktop.page.waitForEvent("download"),
        desktop.page
          .getByRole("link", { name: "Download track", exact: true })
          .click(),
      ]);
      assert.ok(download.suggestedFilename().endsWith(".wav"));
      await desktop.page.getByRole("button", { name: "Close dialog" }).click();
    } else {
      await desktop.page
        .getByRole("heading", { name: "Updates coming soon" })
        .waitFor();
      console.log(
        "PASS unpublished music empty state; payment security is covered by integration tests.",
      );
    }
    await login(desktop.page, "super@demo.invalid");
    for (const route of [
      "/admin",
      "/admin/content",
      "/admin/news",
      "/admin/events",
      "/admin/media",
      "/admin/music",
      "/admin/documents",
      "/admin/constituencies",
      "/admin/membership",
      "/admin/collections",
      "/admin/payments",
      "/admin/reports",
      "/admin/users",
      "/admin/audit",
    ])
      await check(
        desktop.page,
        route,
        route === "/admin" ? "admin-desktop" : undefined,
      );
    for (const route of ["/", "/music", "/contact"])
      await check(small.page, route);
  }
  await login(phone.page, "secretary-a@demo.invalid");
  for (const route of [
    "/portal",
    "/portal/membership",
    "/portal/submit",
    "/portal/collections",
    "/portal/history",
    "/portal/account",
  ])
    await check(
      phone.page,
      route,
      route === "/portal"
        ? "portal-mobile"
        : route === "/portal/membership"
          ? "membership-mobile"
          : undefined,
    );
  await phone.page.goto(`${base}/portal/membership`, {
    waitUntil: "networkidle",
  });
  await phone.page.getByRole("button", { name: "Add member" }).click();
  await phone.page.getByRole("dialog").waitFor();
  await phone.page.screenshot({
    path: ".demo/screenshots/member-form-mobile.png",
  });
  await phone.page.keyboard.press("Escape");
  await login(small.page, "secretary-a@demo.invalid");
  await check(small.page, "/portal/membership");
  await check(small.page, "/portal/collections");
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(
    "PASS browser checks for the selected route scope, responsive layout, assets and runtime errors.",
  );
} finally {
  await browser.close();
}
