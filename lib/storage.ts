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
  const matches =
    category === "csv" ||
    (category === "document" && bytes.subarray(0, 5).toString() === "%PDF-") ||
    (category === "image" &&
      ((extension === ".png" &&
        bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") ||
        ([".jpg", ".jpeg"].includes(extension) &&
          bytes.subarray(0, 3).toString("hex") === "ffd8ff") ||
        (extension === ".webp" &&
          bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP"))) ||
    (category === "audio" &&
      ((extension === ".wav" &&
        bytes.subarray(0, 4).toString() === "RIFF" &&
        bytes.subarray(8, 12).toString() === "WAVE") ||
        (extension === ".ogg" && bytes.subarray(0, 4).toString() === "OggS") ||
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
      throw new Error("Private documents cannot be public.");
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
  return /^(public|private)\/(audio|image|document|csv)\/(?:[A-Za-z0-9_-]+\/)?[a-f0-9-]{36}\.(mp3|wav|ogg|png|jpg|jpeg|webp|pdf|csv)$/.test(
    key,
  );
}

export class VercelBlobStorageProvider implements StorageProvider {
  async put(file: File, category: UploadCategory, isPublic = false) {
    const bytes = await validateUpload(file, category);
    if (isPublic && category !== "image" && category !== "audio")
      throw new Error("Private documents cannot be public.");
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
