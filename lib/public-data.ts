import { db } from "./db";
export async function publicTracks() {
  const rows = await db.track.findMany({
    where: { isPublished: true, archived: false },
    select: {
      id: true,
      slug: true,
      title: true,
      artist: true,
      description: true,
      artwork: true,
      previewUrl: true,
      price: true,
      currency: true,
      downloadType: true,
      category: true,
      releaseDate: true,
    },
    orderBy: { releaseDate: "desc" },
  });
  return rows.map((t) => ({
    ...t,
    price: t.price.toString(),
    releaseDate: t.releaseDate.toISOString(),
  }));
}
export type PublicTrack = Awaited<ReturnType<typeof publicTracks>>[number];
export type PublicContent = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  body: string;
  image: string | null;
  eventDate: string | null;
  createdAt: string;
};
export async function publicContent(kind?: string): Promise<PublicContent[]> {
  const rows = await db.content.findMany({
    where: { isPublished: true, ...(kind ? { kind } : {}) },
    select: {
      id: true,
      kind: true,
      title: true,
      summary: true,
      body: true,
      image: true,
      eventDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((c) => ({
    ...c,
    eventDate: c.eventDate?.toISOString() || null,
    createdAt: c.createdAt.toISOString(),
  }));
}
