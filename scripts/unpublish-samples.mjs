import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());
if (process.env.DEMO_MODE !== "true")
  throw new Error("Sample cleanup is limited to the local test environment.");
const db = new PrismaClient();
const contentSamples = [
  ["demo-news-1", "A connected platform for every constituency"],
  ["demo-news-2", "Keeping members informed, wherever they are"],
  ["demo-news-3", "A simpler way to connect and participate"],
  ["demo-event-1", "Digital platform presentation"],
  ["demo-media-1", "Illustrative mountain landscape"],
  ["demo-doc-1", "Digital platform proposal overview"],
];
const trackSamples = [
  ["demo-track-1", "Together, a new day"],
  ["demo-track-2", "Mountain morning"],
  ["demo-track-3", "A shared rhythm"],
];
try {
  const counts = await db.$transaction(async (tx) => {
    const content = await tx.content.findMany({
      where: {
        isPublished: true,
        OR: contentSamples.map(([id, title]) => ({ id, title })),
      },
      select: { id: true },
    });
    const tracks = await tx.track.findMany({
      where: {
        isPublished: true,
        artist: "Demonstration Studio",
        OR: trackSamples.map(([slug, title]) => ({ slug, title })),
      },
      select: { id: true },
    });
    for (const [entityType, rows, model] of [
      ["Content", content, tx.content],
      ["Track", tracks, tx.track],
    ]) {
      for (const row of rows) {
        await model.update({
          where: { id: row.id },
          data: { isPublished: false },
        });
        await tx.auditLog.create({
          data: {
            action: "SAMPLE_UNPUBLISHED",
            entityType,
            entityId: row.id,
            metadata: { reason: "Remove seeded samples from public listings" },
          },
        });
      }
    }
    return { content: content.length, tracks: tracks.length };
  });
  console.log(
    `Unpublished ${counts.content} sample entries and ${counts.tracks} sample tracks. No records deleted.`,
  );
} finally {
  await db.$disconnect();
}
