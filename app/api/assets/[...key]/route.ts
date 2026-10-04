import { extname } from "node:path";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/security";
import { cloudUploads, isBlobKey } from "@/lib/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  try {
    const key = `public/${(await context.params).key.join("/")}`;
    if (
      !cloudUploads ||
      !isBlobKey(key) ||
      !/^public\/(audio|image)\//.test(key)
    )
      throw new HttpError(404, "File not found.");
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
    };
    const contentType = types[extname(key)];
    if (!contentType) throw new HttpError(404, "File not found.");
    const assetUrl = `/api/assets/${key.slice("public/".length)}`;
    const [track, content] = await Promise.all([
      db.track.findFirst({
        where: { OR: [{ previewUrl: assetUrl }, { artwork: assetUrl }] },
        select: { id: true },
      }),
      db.content.findFirst({
        where: { image: assetUrl },
        select: { id: true },
      }),
    ]);
    if (!track && !content) throw new HttpError(404, "File not found.");
    const range = request.headers.get("range");
    const blob = await get(key, {
      access: "private",
      headers: range ? { Range: range } : undefined,
    });
    if (!blob || blob.statusCode !== 200)
      throw new HttpError(404, "File not found.");
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of [
      "content-range",
      "content-length",
      "accept-ranges",
      "etag",
      "last-modified",
    ]) {
      const value = blob.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(blob.stream, {
      status: headers.has("content-range") ? 206 : 200,
      headers,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
