import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, sep, extname, basename } from "node:path";
import { get, head, put } from "@vercel/blob";
import { HttpError } from "./security";
import { uploadRules, type UploadCategory } from "./upload-rules";
export interface StorageProvider {
  put(
    file: File,
    category: UploadCategory,
    isPublic?: boolean,
  ): Promise<string>;
  read(key: string): Promise<Buffer>;
  stream(key: string): Promise<ReadableStream<Uint8Array>>;
}
function hasPrefix(bytes: Buffer, prefix: string | number[]) {
  if (typeof prefix === "string")
    return bytes.subarray(0, prefix.length).toString() === prefix;
  return prefix.every((value, index) => bytes[index] === value);
}

function isZip(bytes: Buffer) {
  return (
    hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    hasPrefix(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    hasPrefix(bytes, [0x50, 0x4b, 0x07, 0x08])
  );
}

function isIsoMedia(bytes: Buffer) {
  return bytes.length >= 12 && bytes.subarray(4, 8).toString() === "ftyp";
}

function isText(bytes: Buffer) {
  return !bytes.subarray(0, Math.min(bytes.length, 1024)).includes(0);
}

async function validateUpload(file: File, category: UploadCategory) {
  const rules = uploadRules[category];
  const extension = extname(file.name).toLowerCase();
  if (
    !rules.types.includes(file.type) ||
    !rules.extensions.includes(extension) ||
    !file.size ||
    file.size > rules.limit
  )
    throw new HttpError(400, `Invalid ${category} file type or size.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const oleDocument = hasPrefix(bytes, [
    0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
  ]);
  const matches =
    (category === "csv" && isText(bytes)) ||
    (category === "archive" &&
      ((extension === ".zip" && isZip(bytes)) ||
        (extension === ".7z" &&
          hasPrefix(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) ||
        (extension === ".rar" && hasPrefix(bytes, "Rar!\x1a\x07")))) ||
    (category === "video" &&
      (([".mp4", ".mov", ".m4v"].includes(extension) && isIsoMedia(bytes)) ||
        (extension === ".webm" &&
          hasPrefix(bytes, [0x1a, 0x45, 0xdf, 0xa3])))) ||
    (category === "document" &&
      ((extension === ".pdf" && bytes.subarray(0, 5).toString() === "%PDF-") ||
        ([".txt", ".md"].includes(extension) && isText(bytes)) ||
        (extension === ".rtf" && bytes.subarray(0, 5).toString() === "{\\rtf") ||
        ([".doc", ".xls", ".ppt"].includes(extension) && oleDocument) ||
        ([".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp"].includes(
          extension,
        ) &&
          isZip(bytes)))) ||
    (category === "image" &&
      ((extension === ".png" &&
        bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") ||
        ([".jpg", ".jpeg"].includes(extension) &&
          bytes.subarray(0, 3).toString("hex") === "ffd8ff") ||
        (extension === ".webp" &&
          bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP") ||
        (extension === ".gif" &&
          ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString())) ||
        (extension === ".avif" &&
          isIsoMedia(bytes) &&
          ["avif", "avis"].includes(bytes.subarray(8, 12).toString())))) ||
    (category === "audio" &&
      ((extension === ".wav" &&
        bytes.subarray(0, 4).toString() === "RIFF" &&
        bytes.subarray(8, 12).toString() === "WAVE") ||
        (extension === ".ogg" && bytes.subarray(0, 4).toString() === "OggS") ||
        (extension === ".flac" && bytes.subarray(0, 4).toString() === "fLaC") ||
        (extension === ".m4a" && isIsoMedia(bytes)) ||
        (extension === ".mp3" &&
          (bytes.subarray(0, 3).toString() === "ID3" ||
            (bytes[0] === 255 && (bytes[1] & 224) === 224)))));
  if (!matches)
    throw new HttpError(400, "File contents do not match the allowed type.");
  return bytes;
}
export class LocalStorageProvider implements StorageProvider {
  private root = resolve(
    /* turbopackIgnore: true */ process.env.STORAGE_ROOT || "private-storage",
  );
  path(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep))
      throw new Error("Invalid storage key.");
    return path;
  }
  async put(file: File, category: UploadCategory, isPublic = false) {
    const bytes = await validateUpload(file, category);
    const extension = extname(file.name).toLowerCase();
    if (isPublic && category !== "image" && category !== "audio")
      throw new Error("Only audio and images can be public uploads.");
    const key = `${category}/${randomUUID()}${extension}`;
    const target = isPublic ? resolve("public/uploads", key) : this.path(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    return isPublic ? `/uploads/${key}` : key;
  }
  read(key: string) {
    return readFile(this.path(key));
  }
  async stream(key: string) {
    return new Response(new Uint8Array(await this.read(key))).body!;
  }
}

export function isBlobKey(key: string) {
  return /^(public|private)\/(audio|image|video|document|archive|csv)\/(?:[A-Za-z0-9_-]+\/)?[a-f0-9-]{36}\.(mp3|wav|ogg|m4a|flac|png|jpg|jpeg|webp|gif|avif|mp4|webm|mov|m4v|pdf|txt|md|rtf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|zip|rar|7z|csv)$/i.test(
    key,
  );
}

export class VercelBlobStorageProvider implements StorageProvider {
  async put(file: File, category: UploadCategory, isPublic = false) {
    const bytes = await validateUpload(file, category);
    if (isPublic && category !== "image" && category !== "audio")
      throw new Error("Only audio and images can be public uploads.");
    const key = `${isPublic ? "public" : "private"}/${category}/${randomUUID()}${extname(file.name).toLowerCase()}`;
    await put(key, bytes, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return isPublic ? `/api/assets/${key.slice("public/".length)}` : key;
  }
  async stream(key: string) {
    if (!isBlobKey(key)) throw new HttpError(400, "Invalid storage key.");
    const blob = await get(key, { access: "private" });
    if (!blob || blob.statusCode !== 200)
      throw new HttpError(404, "File not found.");
    return blob.stream;
  }
  async read(key: string) {
    return Buffer.from(
      await new Response(await this.stream(key)).arrayBuffer(),
    );
  }
  async acceptUpload(
    key: string,
    category: UploadCategory,
    isPublic: boolean,
    userId: string,
  ) {
    const prefix = `${isPublic ? "public" : "private"}/${category}/${userId}/`;
    if (!isBlobKey(key) || !key.startsWith(prefix))
      throw new HttpError(400, "Invalid uploaded file reference.");
    const metadata = await head(key);
    const rules = uploadRules[category];
    if (!metadata.size || metadata.size > rules.limit)
      throw new HttpError(400, `Invalid ${category} file size.`);
    const bytes = await this.read(key);
    await validateUpload(
      new File([new Uint8Array(bytes)], basename(key), {
        type: metadata.contentType,
      }),
      category,
    );
    return isPublic ? `/api/assets/${key.slice("public/".length)}` : key;
  }
}

export const cloudUploads =
  process.env.STORAGE_PROVIDER === "vercel-blob" || process.env.VERCEL === "1";
export const storage: StorageProvider = cloudUploads
  ? new VercelBlobStorageProvider()
  : new LocalStorageProvider();

export async function saveUpload(
  value: FormDataEntryValue | null | undefined,
  category: UploadCategory,
  isPublic: boolean,
  userId: string,
) {
  if (value instanceof File && value.size)
    return storage.put(value, category, isPublic);
  if (typeof value === "string" && value) {
    if (!(storage instanceof VercelBlobStorageProvider))
      throw new HttpError(400, "Invalid uploaded file reference.");
    return storage.acceptUpload(value, category, isPublic, userId);
  }
  return undefined;
}
