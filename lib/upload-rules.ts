export const uploadCategories = ["audio", "image", "document", "csv"] as const;
export type UploadCategory = (typeof uploadCategories)[number];

export const uploadRules = {
  audio: {
    limit: 30 * 1024 * 1024,
    types: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg"],
    extensions: [".mp3", ".wav", ".ogg"],
  },
  image: {
    limit: 5 * 1024 * 1024,
    types: ["image/png", "image/jpeg", "image/webp"],
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
  },
  document: {
    limit: 10 * 1024 * 1024,
    types: ["application/pdf"],
    extensions: [".pdf"],
  },
  csv: {
    limit: 1024 * 1024,
    types: ["text/csv", "application/vnd.ms-excel", "text/plain"],
    extensions: [".csv"],
  },
};
