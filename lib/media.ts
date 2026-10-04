import { uploadRules, type UploadCategory } from "./upload-rules";

export const mediaCategories = ["photos", "videos", "speeches", "press"] as const;
export type MediaCategory = (typeof mediaCategories)[number];
export const mediaLabels: Record<MediaCategory, string> = {
  photos: "Photos",
  videos: "Videos",
  speeches: "Speeches",
  press: "Press",
};
export const mediaUploadCategories: Record<
  MediaCategory,
  readonly UploadCategory[]
> = {
  photos: ["image"],
  videos: ["video"],
  speeches: ["audio", "video", "document"],
  press: ["document", "image", "archive"],
};

export function mediaLinkUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function linkedMediaType(
  value: string | null | undefined,
): UploadCategory | null {
  const link = mediaLinkUrl(value);
  if (!link) return null;
  const path = new URL(link).pathname.toLowerCase();
  return (
    (["image", "video", "audio", "document", "archive"] as const).find(
      (category) => uploadRules[category].extensions.some(
        (extension) => path.endsWith(extension),
      ),
    ) || null
  );
}

export function mediaCategoryFor(item: {
  mediaCategory?: string | null;
  attachmentCategory?: UploadCategory | null;
  externalUrl?: string | null;
}): MediaCategory {
  if (mediaCategories.includes(item.mediaCategory as MediaCategory))
    return item.mediaCategory as MediaCategory;
  const type = item.attachmentCategory || linkedMediaType(item.externalUrl);
  if (type === "video") return "videos";
  if (type === "audio") return "speeches";
  if (type === "document" || type === "archive") return "press";
  return "photos";
}
