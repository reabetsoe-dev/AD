import { db } from "./db";
import { extname } from "node:path";
import { mediaCategoryFor, mediaLinkUrl, type MediaCategory } from "./media";
import {
  contentAttachmentCategories,
  mimeTypeForExtension,
  uploadCategoryFromPath,
  type UploadCategory,
} from "./upload-rules";

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
export type PublicAttachment = {
  category: UploadCategory;
  extension: string;
  mimeType: string;
  url: string;
  downloadUrl: string;
};
export type PublicContent = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  body: string;
  image: string | null;
  eventDate: string | null;
  createdAt: string;
  hasAttachment: boolean;
  attachment: PublicAttachment | null;
  mediaCategory: MediaCategory | null;
  externalUrl: string | null;
};

function publicAttachment(id: string, storageKey: string | null) {
  if (!storageKey) return null;
  const category = uploadCategoryFromPath(storageKey, contentAttachmentCategories);
  if (!category) return null;
  const extension = extname(storageKey).toLowerCase();
  const path = `/api/documents/${encodeURIComponent(id)}`;
  return {
    category,
    extension,
    mimeType: mimeTypeForExtension(extension),
    url: `${path}?inline=1`,
    downloadUrl: path,
  };
}

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
      storageKey: true,
      mediaCategory: true,
      externalUrl: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(({ storageKey, ...c }) => {
    const attachment = publicAttachment(c.id, storageKey);
    return {
      ...c,
      hasAttachment: !!storageKey,
      attachment,
      mediaCategory: c.kind === "media"
        ? mediaCategoryFor({ ...c, attachmentCategory: attachment?.category })
        : null,
      externalUrl: mediaLinkUrl(c.externalUrl),
      eventDate: c.eventDate?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
    };
  });
}
