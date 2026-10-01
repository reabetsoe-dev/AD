import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { db } from "../lib/db";
import { can, permissions, scopeFor } from "../lib/permissions";
import { parseMembers } from "../lib/import";
import { MockMpesaProvider } from "../lib/payments";
import { isBlobKey, VercelBlobStorageProvider } from "../lib/storage";
const base = process.env.APP_URL || "http://127.0.0.1:3000";
const runId = `TEST-${randomUUID().slice(0, 8)}`;
const sessions: Record<string, string> = {};
let a: string,
  b: string,
  bMember: string,
  paid: string,
  free: string,
  unpublished: string,
  purchaseId: string,
  purchaseCookie: string,
  collectionId: string;
const uploadedTracks: string[] = [];
const adminTestEntities: string[] = [];
const temporaryUsers: string[] = [];
const cookies = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
async function request(
  path: string,
  cookie = "",
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  return fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
before(async () => {
  assert.equal(
    process.env.DEMO_MODE,
    "true",
    "Tests only run against fictional demo data.",
  );
  const ca = await db.constituency.findUniqueOrThrow({
      where: { code: "DEMO-A" },
    }),
    cb = await db.constituency.findUniqueOrThrow({ where: { code: "DEMO-B" } });
  a = ca.id;
  b = cb.id;
  bMember = (await db.member.findFirstOrThrow({ where: { constituencyId: b } }))
    .id;
  const template = {
    artist: "Integration Demo",
    description: "Fictional security test audio",
    artwork: "/ad-logo.png",
    audioStorageKey: "audio/demo-1.wav",
    previewUrl: "/preview-1.wav",
    currency: "LSL",
  };
  paid = (
    await db.track.create({
      data: {
        ...template,
        slug: `${runId}-paid`,
        title: `${runId} paid`,
        downloadType: "PAID",
        price: 15,
        isPublished: true,
      },
    })
  ).id;
  free = (
    await db.track.create({
      data: {
        ...template,
        slug: `${runId}-free`,
        title: `${runId} free`,
        downloadType: "FREE",
        price: 0,
        isPublished: true,
      },
    })
  ).id;
  unpublished = (
    await db.track.create({
      data: {
        ...template,
        slug: `${runId}-hidden`,
        title: `${runId} hidden`,
        downloadType: "PAID",
        price: 15,
        isPublished: false,
      },
    })
  ).id;
  for (const role of [
    "admin",
    "media",
    "finance",
    "secretary-a",
    "secretary-b",
  ]) {
    const response = await request("/api/auth/sign-in/email", "", {
      email: `${role}@demo.invalid`,
      password: process.env.DEMO_SEED_PASSWORD,
    });
    assert.equal(
      response.status,
      200,
      `Sign-in for ${role}: ${await response.clone().text()}`,
    );
    sessions[role] = cookies(response);
    assert.match(response.headers.getSetCookie().join(";"), /HttpOnly/i);
  }
});
after(async () => {
  const ids = [paid, free, unpublished, ...uploadedTracks].filter(Boolean),
    purchases = await db.musicPurchase.findMany({
      where: { trackId: { in: ids } },
      select: { id: true },
    }),
    pids = purchases.map((p) => p.id);
  await db.download.deleteMany({ where: { trackId: { in: ids } } });
  await db.downloadEntitlement.deleteMany({
    where: { purchaseId: { in: pids } },
  });
  await db.paymentTransaction.deleteMany({
    where: { purchaseId: { in: pids } },
  });
  await db.musicPurchase.deleteMany({ where: { id: { in: pids } } });
  await db.track.deleteMany({ where: { id: { in: ids } } });
  await db.member.deleteMany({
    where: { memberNumber: { startsWith: runId } },
  });
  await db.membershipSubmission.deleteMany({
    where: { reportingPeriod: runId },
  });
  await db.collectionReport.deleteMany({ where: { reportingPeriod: runId } });
  await db.content.deleteMany({ where: { title: { startsWith: runId } } });
  await db.auditLog.deleteMany({
    where: {
      OR: [
        {
          entityId: {
            in: [...ids, ...pids, collectionId, ...adminTestEntities].filter(Boolean),
          },
        },
        { metadata: { path: ["test"], equals: runId } },
      ],
    },
  });
  await db.auditLog.deleteMany({
    where: { actorUserId: { in: temporaryUsers } },
  });
  await db.user.deleteMany({ where: { id: { in: temporaryUsers } } });
  await db.session.deleteMany({
    where: {
      token: {
        in: Object.values(sessions).map((c) =>
          decodeURIComponent(c.split("=")[1]?.split(".")[0] || ""),
        ),
      },
    },
  });
  await db.$disconnect();
});
test("RBAC grants separate media, finance and membership permissions", () => {
  assert.equal(can("MEDIA_MANAGER", "VIEW_FINANCE"), false);
  assert.equal(can("FINANCE_OFFICER", "SUBMIT_CONSTITUENCY_MEMBERSHIP"), false);
  assert.equal(can("SECRETARY_GENERAL", "MANAGE_USERS"), false);
  assert.equal(can("FINANCE_OFFICER", "VERIFY_PAYMENTS"), true);
});

test("Administrator includes every Media Manager, Finance Officer and Editor permission", () => {
  for (const role of ["MEDIA_MANAGER", "FINANCE_OFFICER", "EDITOR"] as const)
    for (const permission of permissions)
      if (can(role, permission))
        assert.equal(can("ADMIN", permission), true, `${role}: ${permission}`);
});
test("constituency scope comes only from the authenticated user", () => {
  assert.deepEqual(
    scopeFor({ role: "SECRETARY_GENERAL", assignedConstituencyId: a }),
    { constituencyId: a },
  );
  assert.throws(() =>
    scopeFor({ role: "SECRETARY_GENERAL", assignedConstituencyId: null }),
  );
});
test("anonymous users cannot read internal records", async () => {
  assert.equal((await request("/api/internal/members")).status, 401);
  const page = await request("/admin");
  assert.equal(page.status, 307);
  assert.match(page.headers.get("location") || "", /portal\/login/);
});
test("Secretary A cannot read Secretary B's constituency, even using a query parameter", async () => {
  const response = await request(
    `/api/internal/members?constituencyId=${b}`,
    sessions["secretary-a"],
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.records.length > 0);
  assert.ok(
    data.records.every(
      (row: { constituencyId: string }) => row.constituencyId === a,
    ),
  );
});
test("Secretary A cannot edit a record belonging to B", async () => {
  const response = await request(
    "/api/internal/members",
    sessions["secretary-a"],
    {
      id: bMember,
      memberNumber: `${runId}-001`,
      firstName: "Fictional",
      lastName: "Test",
    },
  );
  assert.equal(response.status, 404);
  const member = await db.member.findUniqueOrThrow({ where: { id: bMember } });
  assert.equal(member.constituencyId, b);
});
test("Secretary A cannot assign new members to B in the request body", async () => {
  assert.equal(
    (
      await request("/api/internal/members", sessions["secretary-a"], {
        constituencyId: b,
        memberNumber: `${runId}-002`,
        firstName: "Fictional",
        lastName: "Test",
      })
    ).status,
    403,
  );
});
test("Media Manager cannot access Finance endpoints", async () => {
  for (const path of ["payments", "collections", "reports"])
    assert.equal(
      (await request(`/api/internal/${path}`, sessions.media)).status,
      403,
    );
});
test("Finance cannot read or modify membership", async () => {
  assert.equal(
    (await request("/api/internal/members", sessions.finance)).status,
    403,
  );
  assert.equal(
    (
      await request("/api/internal/members", sessions.finance, {
        memberNumber: `${runId}-003`,
        firstName: "Fictional",
        lastName: "Test",
      })
    ).status,
    403,
  );
});
test("paid audio is not downloadable before payment", async () => {
  assert.equal((await request(`/api/download/${paid}`)).status, 403);
  assert.equal((await request("/audio/demo-1.wav")).status, 404);
});
test("unpublished audio cannot be purchased", async () => {
  assert.equal(
    (
      await request("/api/checkout", "", {
        trackId: unpublished,
        phone: "58000000",
      })
    ).status,
    404,
  );
});
test("successful payment grants entitlement and repeat confirmation is idempotent", async () => {
  const started = await request("/api/checkout", "", {
    trackId: paid,
    phone: "58000000",
  });
  assert.equal(started.status, 200);
  purchaseCookie = cookies(started);
  const p = await started.json();
  purchaseId = p.id;
  assert.equal(p.status, "PENDING");
  assert.equal(
    (await request(`/api/download/${paid}`, purchaseCookie)).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/checkout/${purchaseId}`, "", {
        outcome: "SUCCESSFUL",
      })
    ).status,
    403,
  );
  const confirmed = await request(
    `/api/checkout/${purchaseId}`,
    purchaseCookie,
    { outcome: "SUCCESSFUL" },
  );
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).status, "SUCCESSFUL");
  const repeated = await request(
    `/api/checkout/${purchaseId}`,
    purchaseCookie,
    { outcome: "SUCCESSFUL" },
  );
  assert.equal(repeated.status, 200);
  assert.equal(
    await db.downloadEntitlement.count({ where: { purchaseId } }),
    1,
  );
  assert.equal(await db.paymentTransaction.count({ where: { purchaseId } }), 1);
  const download = await request(`/api/download/${paid}`, purchaseCookie);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-type") || "", /audio/);
  assert.ok((await download.arrayBuffer()).byteLength > 1000);
});
test("free published track can download", async () => {
  assert.equal((await request(`/api/download/${free}`)).status, 200);
});
test("music removal permanently deletes active and archived tracks and their dependent records", async () => {
  for (const archived of [false, true]) {
    const track = await db.track.create({
      data: {
        slug: `${runId}-removable-${archived}`,
        title: `${runId} removable with history`,
        artist: "Integration Demo",
        description: "Fictional permanent deletion test",
        artwork: "/ad-logo.png",
        audioStorageKey: "audio/demo-1.wav",
        previewUrl: "/preview-1.wav",
        currency: "LSL",
        downloadType: "PAID",
        price: 15,
        isPublished: !archived,
        archived,
        downloads: { create: {} },
        purchases: {
          create: {
            customerHash: runId,
            phoneMasked: "58****00",
            amount: 15,
            currency: "LSL",
            status: "SUCCESSFUL",
            entitlement: { create: {} },
            transaction: {
              create: {
                provider: "mock-mpesa",
                providerTransactionId: randomUUID(),
                amount: 15,
                currency: "LSL",
                status: "SUCCESSFUL",
              },
            },
          },
        },
      },
      include: { purchases: { select: { id: true } } },
    });
    uploadedTracks.push(track.id);
    const linkedPurchaseId = track.purchases[0].id;
    const list = await request("/api/internal/music", sessions.admin);
    assert.equal(list.status, 200);
    assert.ok(
      (await list.json()).records.some((row: { id: string }) => row.id === track.id),
    );
    assert.equal(
      (await request("/api/internal/music", sessions.finance, { id: track.id }, "DELETE")).status,
      403,
    );
    assert.ok(await db.track.findUnique({ where: { id: track.id } }));

    const response = await request(
      "/api/internal/music",
      sessions.admin,
      { id: track.id },
      "DELETE",
    );
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(await db.track.findUnique({ where: { id: track.id } }), null);
    assert.equal(await db.download.count({ where: { trackId: track.id } }), 0);
    assert.equal(await db.musicPurchase.count({ where: { trackId: track.id } }), 0);
    assert.equal(await db.paymentTransaction.count({ where: { purchaseId: linkedPurchaseId } }), 0);
    assert.equal(await db.downloadEntitlement.count({ where: { purchaseId: linkedPurchaseId } }), 0);
    assert.equal((await request(`/api/download/${track.id}`)).status, 404);

    const refreshed = await request("/api/internal/music", sessions.admin);
    assert.equal(refreshed.status, 200);
    assert.equal(
      (await refreshed.json()).records.some((row: { id: string }) => row.id === track.id),
      false,
    );
    assert.equal(
      (await request("/api/internal/music", sessions.admin, { id: track.id }, "DELETE")).status,
      404,
    );
  }
  assert.ok(await db.track.findUnique({ where: { id: paid } }));
  assert.ok(await db.musicPurchase.findUnique({ where: { id: purchaseId } }));
  assert.equal(await db.paymentTransaction.count({ where: { purchaseId } }), 1);
  assert.equal(await db.downloadEntitlement.count({ where: { purchaseId } }), 1);
});
test("failed demo payment does not grant entitlement", async () => {
  const start = await request("/api/checkout", "", {
    trackId: paid,
    phone: "58000000",
  });
  assert.equal(start.status, 200);
  const cookie = cookies(start),
    purchase = await start.json();
  const failed = await request(`/api/checkout/${purchase.id}`, cookie, {
    outcome: "FAILED",
  });
  assert.equal(failed.status, 200);
  assert.equal((await failed.json()).status, "FAILED");
  assert.equal(
    await db.downloadEntitlement.count({ where: { purchaseId: purchase.id } }),
    0,
  );
  assert.equal((await request(`/api/download/${paid}`, cookie)).status, 403);
});
test("mock provider rejects forged or stale callback signatures", () => {
  const provider = new MockMpesaProvider(),
    event = {
      reference: runId,
      purchaseId: runId,
      amount: "15.00",
      currency: "LSL",
      status: "SUCCESSFUL" as const,
      timestamp: Date.now(),
    };
  const signature = provider.sign(event);
  assert.equal(provider.verifyPayment(event, signature), true);
  assert.equal(provider.verifyPayment(event, "00".repeat(32)), false);
  const stale = { ...event, timestamp: Date.now() - 360000 };
  assert.equal(provider.verifyPayment(stale, provider.sign(stale)), false);
  assert.equal(
    provider.verifyPayment({ ...event, amount: "0.01" }, signature),
    false,
  );
});
test("Media Manager can upload audio but full files remain private; unpublishing works", async () => {
  const form = new FormData();
  form.set("title", `${runId} uploaded demo`);
  form.set("artist", "Integration Demo");
  form.set("description", "Fictional upload test");
  form.set("category", "Instrumental");
  form.set("downloadType", "PAID");
  form.set("price", "12.00");
  form.set("isPublished", "true");
  form.set(
    "audio",
    new File(
      [new Uint8Array(await readFile("private-storage/audio/demo-1.wav"))],
      "test.wav",
      { type: "audio/wav" },
    ),
  );
  form.set(
    "preview",
    new File(
      [new Uint8Array(await readFile("public/preview-1.wav"))],
      "preview.wav",
      { type: "audio/wav" },
    ),
  );
  const response = await fetch(`${base}/api/internal/music`, {
    method: "POST",
    headers: { Cookie: sessions.media, Origin: base },
    body: form,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  uploadedTracks.push(result.id);
  const track = await db.track.findUniqueOrThrow({ where: { id: result.id } });
  assert.ok(track.audioStorageKey.startsWith("audio/"));
  assert.ok(!track.audioStorageKey.startsWith("/"));
  assert.ok(track.previewUrl.startsWith("/uploads/audio/"));
  assert.equal((await request(`/${track.audioStorageKey}`)).status, 404);
  const update = new FormData();
  for (const [key, value] of Object.entries({
    id: track.id,
    title: track.title,
    artist: track.artist,
    description: track.description,
    category: track.category,
    downloadType: "PAID",
    price: "12",
    isPublished: "",
  }))
    update.set(key, value);
  assert.equal(
    (
      await fetch(`${base}/api/internal/music`, {
        method: "POST",
        headers: { Cookie: sessions.media, Origin: base },
        body: update,
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.track.findUniqueOrThrow({ where: { id: track.id } })).isPublished,
    false,
  );
});
test("executable disguised as audio is rejected before creating a track", async () => {
  const before = await db.track.count();
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: `${runId} invalid upload`,
    artist: "Integration Demo",
    description: "Fictional invalid upload",
    category: "Instrumental",
    downloadType: "FREE",
    price: "0",
    isPublished: "true",
  }))
    form.set(key, value);
  form.set(
    "audio",
    new File(["MZ-not-audio"], "malicious.wav", { type: "audio/wav" }),
  );
  form.set(
    "preview",
    new File(["MZ-not-audio"], "preview.wav", { type: "audio/wav" }),
  );
  const response = await fetch(`${base}/api/internal/music`, {
    method: "POST",
    headers: { Cookie: sessions.media, Origin: base },
    body: form,
  });
  assert.equal(response.status, 400);
  assert.equal(await db.track.count(), before);
});
test("cloud file references reject external URLs, traversal and other users' files", async () => {
  const provider = new VercelBlobStorageProvider();
  const filename = `${randomUUID()}.wav`;
  assert.equal(isBlobKey(`private/audio/test-user/${filename}`), true);
  for (const key of [
    `https://untrusted.invalid/${filename}`,
    `private/audio/../${filename}`,
    `public/audio/other-user/${filename}`,
    `private/audio/other-user/${filename}`,
  ]) {
    await assert.rejects(
      () => provider.acceptUpload(key, "audio", false, "test-user"),
      /Invalid uploaded file reference/,
    );
  }
  assert.equal(isBlobKey(`private/audio/../${filename}`), false);
});

test("direct upload tokens enforce authentication, permissions and file ownership", async () => {
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@demo.invalid" } });
  const payload = {
    type: "blob.generate-client-token",
    payload: {
      pathname: `private/audio/other-user/${randomUUID()}.wav`,
      multipart: true,
      clientPayload: JSON.stringify({ category: "audio", isPublic: false }),
    },
  };
  assert.equal((await request("/api/internal/uploads", "", payload)).status, 401);
  assert.equal((await request("/api/internal/uploads", sessions.finance, payload)).status, 403);
  assert.equal((await request("/api/internal/uploads", sessions.admin, payload)).status, 400);
  payload.payload.pathname = `public/document/${admin.id}/${randomUUID()}.pdf`;
  payload.payload.clientPayload = JSON.stringify({ category: "document", isPublic: true });
  assert.equal((await request("/api/internal/uploads", sessions.admin, payload)).status, 400);
  const response = await fetch(`${base}/api/internal/uploads`, {
    method: "POST",
    headers: { Cookie: sessions.admin, Origin: "https://untrusted.invalid", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 403);
});

test("public asset routes do not expose full audio or private documents", async () => {
  for (const path of [
    `/api/assets/private/audio/test-user/${randomUUID()}.wav`,
    `/api/assets/document/test-user/${randomUUID()}.pdf`,
  ]) assert.equal((await request(path)).status, 404);
});

test("Administrator can attach a PDF when creating an event", async () => {
  const title = `${runId} event with upload`;
  const form = new FormData();
  form.set("title", title);
  form.set("summary", "Fictional event upload test");
  form.set("body", "Temporary event created with a supporting file.");
  form.set("eventDate", "2026-10-15T10:00");
  form.set(
    "attachment",
    new File([Buffer.from("%PDF-1.4\nTemporary event upload\n%%EOF")], "event.pdf", {
      type: "application/pdf",
    }),
  );
  const response = await fetch(`${base}/api/internal/events`, {
    method: "POST",
    headers: { Cookie: sessions.admin, Origin: base },
    body: form,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const content = await db.content.findFirstOrThrow({ where: { title } });
  adminTestEntities.push(content.id);
  assert.equal(content.kind, "events");
  assert.ok(content.storageKey?.startsWith("document/"));
});
test("CSV validation rejects invalid rows, duplicate IDs, and supplied constituency fields", () => {
  assert.equal(
    parseMembers(
      "memberNumber,firstName,lastName\nA-1,Demo,Fictional\nA-1,Demo,Other",
    ).valid,
    false,
  );
  assert.equal(
    parseMembers("memberNumber,firstName,lastName\nA-1,,Fictional").valid,
    false,
  );
  assert.equal(
    parseMembers(
      "memberNumber,firstName,lastName,constituencyId\nA-1,Demo,Fictional,other",
    ).valid,
    false,
  );
  assert.equal(
    parseMembers("memberNumber,firstName,lastName\nA-1,Demo,Fictional", ["A-1"])
      .valid,
    false,
  );
});
test("membership import preview inserts nothing; confirmation imports into A", async () => {
  const csv = `memberNumber,firstName,lastName\n${runId}-101,Integration,Fictional`;
  const before = await db.member.count({ where: { constituencyId: a } });
  const preview = await request(
    "/api/internal/import",
    sessions["secretary-a"],
    { csv, confirm: false },
  );
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).valid, true);
  assert.equal(await db.member.count({ where: { constituencyId: a } }), before);
  assert.equal(
    (
      await request("/api/internal/import", sessions["secretary-a"], {
        csv,
        confirm: true,
      })
    ).status,
    200,
  );
  assert.equal(
    await db.member.count({ where: { constituencyId: a } }),
    before + 1,
  );
  assert.equal(
    (
      await request("/api/internal/import", sessions["secretary-a"], {
        csv,
        confirm: true,
      })
    ).status,
    400,
  );
});
test("membership submission preserves its member snapshot", async () => {
  assert.equal(
    (
      await request("/api/internal/submissions", sessions["secretary-a"], {
        reportingPeriod: runId,
        notes: "Fictional test submission",
      })
    ).status,
    200,
  );
  const submission = await db.membershipSubmission.findFirstOrThrow({
    where: { reportingPeriod: runId },
  });
  assert.equal(submission.constituencyId, a);
  assert.ok(Array.isArray(submission.snapshot));
  await db.member.create({
    data: {
      constituencyId: a,
      memberNumber: `${runId}-102`,
      firstName: "Integration",
      lastName: "Fictional",
    },
  });
  const unchanged = await db.membershipSubmission.findUniqueOrThrow({
    where: { id: submission.id },
  });
  assert.deepEqual(unchanged.snapshot, submission.snapshot);
});
test("collection reference stays pending and requires an authorised independent verifier", async () => {
  assert.equal(
    (
      await request("/api/internal/collections", sessions["secretary-a"], {
        reportingPeriod: runId,
        amount: 45,
        paymentReference: `${runId}-MPESA`,
        notes: "Fictional collection test",
      })
    ).status,
    200,
  );
  const report = await db.collectionReport.findFirstOrThrow({
    where: { reportingPeriod: runId },
  });
  collectionId = report.id;
  assert.equal(report.status, "PENDING_VERIFICATION");
  assert.equal(report.verifiedAmount, null);
  const body = {
    id: report.id,
    status: "VERIFIED",
    verifiedAmount: 40,
    verificationNotes: "Simulated finance check; no real money.",
  };
  assert.equal(
    (await request("/api/internal/collections", sessions.media, body)).status,
    403,
  );
  assert.notEqual(
    (await request("/api/internal/collections", sessions["secretary-a"], body))
      .status,
    200,
  );
  assert.equal(
    (await request("/api/internal/collections", sessions.finance, body)).status,
    200,
  );
  const verified = await db.collectionReport.findUniqueOrThrow({
    where: { id: report.id },
  });
  assert.equal(verified.status, "VERIFIED");
  assert.equal(verified.reportedAmount.toString(), "45");
  assert.equal(verified.verifiedAmount?.toString(), "40");
  assert.ok(verified.verifiedById);
  assert.equal(
    (await request("/api/internal/collections", sessions.finance, body)).status,
    409,
  );
});

test("Administrator handles publishing, media, music and verification in one session", async () => {
  for (const resource of [
    "news",
    "events",
    "documents",
    "media",
    "music",
    "members",
    "submissions",
    "collections",
    "payments",
    "reports",
    "users",
    "constituencies",
    "audit",
  ])
    assert.equal(
      (await request(`/api/internal/${resource}`, sessions.admin)).status,
      200,
      resource,
    );

  for (const resource of ["news", "media"]) {
    const title = `${runId} admin ${resource}`;
    assert.equal(
      (
        await request(`/api/internal/${resource}`, sessions.admin, {
          title,
          summary: "Fictional administrator workflow test",
          body: "Temporary test content; not published.",
          isPublished: false,
        })
      ).status,
      200,
      resource,
    );
    const content = await db.content.findFirstOrThrow({ where: { title } });
    adminTestEntities.push(content.id);
    assert.equal(content.isPublished, false);
  }

  const track = await db.track.findUniqueOrThrow({ where: { id: unpublished } });
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: track.id,
    title: track.title,
    artist: track.artist,
    description: track.description,
    category: track.category,
    downloadType: "PAID",
    price: "18",
    isPublished: "",
  }))
    form.set(key, value);
  assert.equal(
    (
      await fetch(`${base}/api/internal/music`, {
        method: "POST",
        headers: { Cookie: sessions.admin, Origin: base },
        body: form,
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.track.findUniqueOrThrow({ where: { id: track.id } })).price.toString(),
    "18",
  );

  assert.equal(
    (
      await request("/api/internal/collections", sessions["secretary-a"], {
        reportingPeriod: runId,
        amount: 30,
        paymentReference: `${runId}-ADMIN-MPESA`,
        notes: "Fictional collection for administrator verification.",
      })
    ).status,
    200,
  );
  const report = await db.collectionReport.findFirstOrThrow({
    where: { paymentReference: `${runId}-ADMIN-MPESA` },
  });
  adminTestEntities.push(report.id);
  const decision = {
    id: report.id,
    status: "VERIFIED",
    verifiedAmount: 30,
    verificationNotes: "Simulated administrator review; no real money.",
  };
  assert.equal(
    (await request("/api/internal/collections", sessions.admin, decision)).status,
    200,
  );
  const administrator = await db.user.findUniqueOrThrow({
    where: { email: "admin@demo.invalid" },
  });
  const verified = await db.collectionReport.findUniqueOrThrow({
    where: { id: report.id },
  });
  assert.equal(verified.status, "VERIFIED");
  assert.equal(verified.verifiedById, administrator.id);
  assert.ok(
    await db.auditLog.findFirst({
      where: {
        entityId: report.id,
        actorUserId: administrator.id,
        action: "COLLECTION_VERIFIED",
      },
    }),
  );
  assert.equal(
    (await request("/api/internal/collections", sessions.admin, decision)).status,
    409,
  );
});
test("a normal Admin cannot create a Super Admin", async () => {
  assert.equal(
    (
      await request("/api/internal/users", sessions.admin, {
        name: "Fictional",
        email: "test@demo.invalid",
        role: "SUPER_ADMIN",
        password: "Fictional-password-123",
      })
    ).status,
    403,
  );
});

test("Administrator cannot verify their own collection report", async () => {
  const administrator = await db.user.findUniqueOrThrow({
    where: { email: "admin@demo.invalid" },
  });
  const report = await db.collectionReport.create({
    data: {
      constituencyId: a,
      submittedById: administrator.id,
      reportingPeriod: runId,
      expectedAmount: 5,
      reportedAmount: 5,
      paymentReference: `${runId}-SELF-REVIEW`,
    },
  });
  adminTestEntities.push(report.id);
  assert.equal(
    (
      await request("/api/internal/collections", sessions.admin, {
        id: report.id,
        status: "VERIFIED",
        verifiedAmount: 5,
        verificationNotes: "Simulated self-verification should be rejected.",
      })
    ).status,
    403,
  );
  assert.equal(
    (await db.collectionReport.findUniqueOrThrow({ where: { id: report.id } }))
      .status,
    "PENDING_VERIFICATION",
  );
});
test("cross-origin mutation is rejected", async () => {
  const response = await fetch(`${base}/api/internal/members`, {
    method: "POST",
    headers: {
      Cookie: sessions["secretary-a"],
      Origin: "https://untrusted.invalid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      memberNumber: `${runId}-999`,
      firstName: "Fictional",
      lastName: "Test",
    }),
  });
  assert.equal(response.status, 403);
});

test("administrators can edit and remove members while constituency removal stays scoped", async () => {
  const member = await db.member.create({
    data: {
      constituencyId: b,
      memberNumber: `${runId}-REMOVE`,
      firstName: "Temporary",
      lastName: "Member",
    },
  });
  adminTestEntities.push(member.id);
  assert.equal(
    (await request("/api/internal/members", sessions["secretary-a"], { id: member.id }, "DELETE")).status,
    404,
  );
  assert.equal(
    (await request("/api/internal/members", sessions.finance, { id: member.id }, "DELETE")).status,
    403,
  );
  assert.equal(
    (await request("/api/internal/members", sessions.admin, {
      id: member.id,
      memberNumber: member.memberNumber,
      firstName: "Updated",
      lastName: member.lastName,
      membershipStatus: "INACTIVE",
    })).status,
    200,
  );
  const updated = await db.member.findUniqueOrThrow({ where: { id: member.id } });
  assert.equal(updated.firstName, "Updated");
  assert.equal(updated.membershipStatus, "INACTIVE");
  assert.equal(updated.constituencyId, b);
  assert.equal(
    (await request("/api/internal/members", sessions.admin, { id: member.id }, "DELETE")).status,
    200,
  );
  assert.equal(await db.member.findUnique({ where: { id: member.id } }), null);
  assert.ok(await db.auditLog.findFirst({ where: { entityId: member.id, action: "MEMBER_REMOVED" } }));
});

test("administrators remove pending reports but preserve reviewed records", async () => {
  const submittedBy = await db.user.findUniqueOrThrow({ where: { email: "secretary-b@demo.invalid" } });
  const submission = await db.membershipSubmission.create({
    data: {
      constituencyId: b,
      submittedById: submittedBy.id,
      reportingPeriod: runId,
      memberCount: 0,
      snapshot: [],
    },
  });
  const report = await db.collectionReport.create({
    data: {
      constituencyId: b,
      submittedById: submittedBy.id,
      reportingPeriod: runId,
      expectedAmount: 12,
      reportedAmount: 12,
      paymentReference: `${runId}-REMOVE`,
    },
  });
  adminTestEntities.push(submission.id, report.id);
  for (const [resource, id] of [["submissions", submission.id], ["collections", report.id]]) {
    assert.equal(
      (await request(`/api/internal/${resource}`, sessions["secretary-a"], { id }, "DELETE")).status,
      404,
    );
    assert.equal(
      (await request(`/api/internal/${resource}`, sessions.admin, { id }, "DELETE")).status,
      200,
    );
  }
  assert.equal(await db.membershipSubmission.findUnique({ where: { id: submission.id } }), null);
  assert.equal(await db.collectionReport.findUnique({ where: { id: report.id } }), null);
  assert.equal(
    (await request("/api/internal/collections", sessions.admin, { id: collectionId }, "DELETE")).status,
    409,
  );
});

test("disable and enable actions revoke sessions and protect privileged accounts", async () => {
  const target = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Temporary action test",
      email: `${runId.toLowerCase()}@demo.invalid`,
      role: "EDITOR",
    },
  });
  temporaryUsers.push(target.id);
  adminTestEntities.push(target.id);
  await db.session.create({
    data: {
      id: randomUUID(),
      userId: target.id,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  assert.equal(
    (await request("/api/internal/users", sessions.admin, { id: target.id, disabled: true }, "PATCH")).status,
    200,
  );
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: target.id } })).disabled, true);
  assert.equal(await db.session.count({ where: { userId: target.id } }), 0);
  assert.equal(
    (await request("/api/internal/users", sessions["secretary-a"], { id: target.id, disabled: false }, "PATCH")).status,
    403,
  );
  assert.equal(
    (await request("/api/internal/users", sessions.admin, { id: target.id, disabled: false }, "PATCH")).status,
    200,
  );
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: target.id } })).disabled, false);
  assert.ok(await db.auditLog.findFirst({ where: { entityId: target.id, action: "USER_ENABLED" } }));
  const administrator = await db.user.findUniqueOrThrow({ where: { email: "admin@demo.invalid" } });
  const superAdmin = await db.user.findUniqueOrThrow({ where: { email: "super@demo.invalid" } });
  for (const method of ["DELETE", "PATCH"]) {
    assert.equal(
      (await request("/api/internal/users", sessions.admin, { id: administrator.id, disabled: true }, method)).status,
      400,
    );
    assert.equal(
      (await request("/api/internal/users", sessions.admin, { id: superAdmin.id, disabled: true }, method)).status,
      403,
    );
  }
});

test("user removal permanently deletes accounts and sessions while retaining audit events", async () => {
  const target = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Temporary permanent deletion test",
      email: `${runId.toLowerCase()}-delete@demo.invalid`,
      role: "EDITOR",
      accounts: {
        create: {
          id: randomUUID(),
          accountId: randomUUID(),
          providerId: "credential",
        },
      },
      sessions: {
        create: {
          id: randomUUID(),
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 60000),
        },
      },
    },
  });
  temporaryUsers.push(target.id);
  adminTestEntities.push(target.id);
  const activity = await db.auditLog.create({
    data: {
      actorUserId: target.id,
      action: "TEST_USER_ACTIVITY",
      entityType: "User",
      entityId: target.id,
    },
  });
  assert.equal(
    (await request("/api/internal/users", sessions["secretary-a"], { id: target.id }, "DELETE")).status,
    403,
  );
  const response = await request("/api/internal/users", sessions.admin, { id: target.id }, "DELETE");
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(await db.user.findUnique({ where: { id: target.id } }), null);
  assert.equal(await db.session.count({ where: { userId: target.id } }), 0);
  assert.equal(await db.account.count({ where: { userId: target.id } }), 0);
  assert.equal((await db.auditLog.findUniqueOrThrow({ where: { id: activity.id } })).actorUserId, null);
  assert.ok(await db.auditLog.findFirst({ where: { entityId: target.id, action: "USER_REMOVED" } }));
  assert.equal(
    (await request("/api/internal/users", sessions.admin, { id: target.id, disabled: false }, "PATCH")).status,
    404,
  );
});

test("user deletion explains linked reports without disabling or deleting the account", async () => {
  const target = await db.user.findUniqueOrThrow({ where: { email: "secretary-a@demo.invalid" } });
  const submission = await db.membershipSubmission.create({
    data: {
      constituencyId: a,
      submittedById: target.id,
      reportingPeriod: runId,
      memberCount: 0,
      snapshot: [],
    },
  });
  adminTestEntities.push(submission.id);
  const response = await request("/api/internal/users", sessions.admin, { id: target.id }, "DELETE");
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /submitted reports/);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: target.id } })).disabled, false);
  assert.ok(await db.membershipSubmission.findUnique({ where: { id: submission.id } }));
});

test("content removal is authorised, kind-specific and rejects cross-origin requests", async () => {
  const record = await db.content.create({
    data: {
      kind: "news",
      title: `${runId} removable news`,
      summary: "Temporary news",
      body: "Temporary news for removal verification.",
    },
  });
  adminTestEntities.push(record.id);
  assert.equal(
    (await request("/api/internal/news", sessions.finance, { id: record.id }, "DELETE")).status,
    403,
  );
  assert.equal(
    (await request("/api/internal/events", sessions.admin, { id: record.id }, "DELETE")).status,
    404,
  );
  const crossOrigin = await fetch(`${base}/api/internal/news`, {
    method: "DELETE",
    headers: { Cookie: sessions.admin, Origin: "https://untrusted.invalid", "Content-Type": "application/json" },
    body: JSON.stringify({ id: record.id }),
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal(
    (await request("/api/internal/news", sessions.admin, { id: record.id }, "DELETE")).status,
    200,
  );
  assert.equal(await db.content.findUnique({ where: { id: record.id } }), null);
});
test("public route and asset smoke checks", async () => {
  for (const path of [
    "/",
    "/about",
    "/leadership",
    "/policies",
    "/manifesto",
    "/candidates",
    "/events",
    "/media",
    "/music",
    "/documents",
    "/contact",
    "/portal/login",
    "/ad-logo.png",
    "/landscape.jpg",
    "/preview-1.wav",
  ])
    assert.equal((await request(path)).status, 200, path);
  const news = await request("/news");
  assert.equal(news.status, 307);
  assert.equal(news.headers.get("location"), "/");
});
test("authorised portal routes work for their roles", async () => {
  for (const path of [
    "/portal",
    "/portal/membership",
    "/portal/submit",
    "/portal/collections",
    "/portal/history",
    "/portal/account",
  ])
    assert.equal(
      (await request(path, sessions["secretary-a"])).status,
      200,
      path,
    );
  for (const path of [
    "/admin",
    "/admin/events",
    "/admin/media",
    "/admin/music",
    "/admin/documents",
    "/admin/constituencies",
    "/admin/reports",
    "/admin/users",
  ])
    assert.equal((await request(path, sessions.admin)).status, 200, path);
});

test("admin navigation uses Events and redirects removed sections", async () => {
  const removed = ["content", "collections", "payments", "audit", "membership"];
  for (const section of removed) {
    const response = await request(`/admin/${section}`, sessions.admin);
    assert.equal(response.status, 307, section);
    assert.equal(response.headers.get("location"), "/admin", section);
  }
  const news = await request("/admin/news", sessions.admin);
  assert.equal(news.status, 307);
  assert.equal(news.headers.get("location"), "/admin/events");
  const overview = await request("/admin", sessions.admin);
  const html = await overview.text();
  for (const section of removed)
    assert.ok(!html.includes(`href="/admin/${section}"`), section);
  assert.ok(!html.includes('href="/admin/news"'));
  assert.ok(html.includes('href="/admin/events"'));
  assert.ok(html.includes("Upcoming events"));
  for (const label of ["Published news", "Simulated music payments", "Pending collections", "Membership submissions"])
    assert.ok(!html.includes(label), label);
});

test("public pages omit proposal branding and unpublished seed samples", async () => {
  for (const path of [
    "/",
    "/about",
    "/events",
    "/media",
    "/music",
    "/documents",
    "/contact",
    "/portal/login",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.doesNotMatch(
      await response.text(),
      /Website Proposal|PLATFORM PROPOSAL|Explore the proposal|From the demonstration newsroom|Together, a new day|Demonstration Studio|AD Proposal/i,
      path,
    );
  }
  assert.equal((await request("/api/documents/demo-doc-1")).status, 404);
});
