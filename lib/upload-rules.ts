export const uploadCategories = [
  "audio",
  "image",
  "video",
  "document",
  "archive",
  "csv",
] as const;
export type UploadCategory = (typeof uploadCategories)[number];

type UploadRule = {
  limit: number;
  types: readonly string[];
  extensions: readonly string[];
};

export const uploadRules: Record<UploadCategory, UploadRule> = {
  audio: {
    limit: 30 * 1024 * 1024,
    types: [
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/mp4",
      "audio/flac",
    ],
    extensions: [".mp3", ".wav", ".ogg", ".m4a", ".flac"],
  },
  image: {
    limit: 10 * 1024 * 1024,
    types: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"],
    extensions: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"],
  },
  video: {
    limit: 100 * 1024 * 1024,
    types: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
    extensions: [".mp4", ".webm", ".mov", ".m4v"],
  },
  document: {
    limit: 25 * 1024 * 1024,
    types: [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/rtf",
      "application/rtf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/vnd.oasis.opendocument.presentation",
    ],
    extensions: [
      ".pdf",
      ".txt",
      ".md",
      ".rtf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".odt",
      ".ods",
      ".odp",
    ],
  },
  archive: {
    limit: 50 * 1024 * 1024,
    types: [
      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/vnd.rar",
      "application/x-7z-compressed",
    ],
    extensions: [".zip", ".rar", ".7z"],
  },
  csv: {
    limit: 1024 * 1024,
    types: ["text/csv", "application/vnd.ms-excel", "text/plain"],
    extensions: [".csv"],
  },
};

export const contentAttachmentCategories = [
  "document",
  "image",
  "audio",
  "video",
  "archive",
] as const satisfies readonly UploadCategory[];

export function uploadExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export function uploadCategoryForFile(
  fileName: string,
  mimeType: string,
  categories: readonly UploadCategory[] = uploadCategories,
) {
  const extension = uploadExtension(fileName);
  return (
    categories.find((category) => {
      const rules = uploadRules[category];
      return (
        rules.extensions.includes(extension) &&
        (!!mimeType ? rules.types.includes(mimeType) : true)
      );
    }) || null
  );
}

export function uploadCategoryFromPath(
  path: string,
  categories: readonly UploadCategory[] = uploadCategories,
) {
  const parts = path.split("/");
  const category = parts[0] === "public" || parts[0] === "private" ? parts[1] : parts[0];
  return uploadCategories.includes(category as UploadCategory) &&
    categories.includes(category as UploadCategory)
    ? (category as UploadCategory)
    : null;
}

export function acceptedTypesFor(categories: readonly UploadCategory[]) {
  return Array.from(
    new Set(
      categories.flatMap((category) => [
        ...uploadRules[category].extensions,
        ...uploadRules[category].types,
      ]),
    ),
  ).join(",");
}

export function mimeTypeForExtension(extension: string) {
  const types: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".rtf": "application/rtf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".zip": "application/zip",
    ".rar": "application/vnd.rar",
    ".7z": "application/x-7z-compressed",
    ".csv": "text/csv; charset=utf-8",
  };
  return types[extension.toLowerCase()] || "application/octet-stream";
}
