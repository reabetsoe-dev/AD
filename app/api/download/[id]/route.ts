import { cookies } from "next/headers";
import { extname } from "node:path";
import { db } from "@/lib/db";
import { mayDownload } from "@/lib/payments";
import { storage } from "@/lib/storage";
import { errorResponse } from "@/lib/security";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const track = await mayDownload(
      (await context.params).id,
      (await cookies()).get("ad-purchase")?.value,
    );
    const stream = await storage.stream(track.audioStorageKey);
    await db.$transaction([
      db.download.create({ data: { trackId: track.id } }),
      db.auditLog.create({
        data: {
          action: "DOWNLOAD_GRANTED",
          entityType: "Track",
          entityId: track.id,
          metadata: { type: track.downloadType },
        },
      }),
    ]);
    const extension = extname(track.audioStorageKey);
    const type =
      extension === ".wav"
        ? "audio/wav"
        : extension === ".ogg"
          ? "audio/ogg"
          : extension === ".m4a"
            ? "audio/mp4"
            : extension === ".flac"
              ? "audio/flac"
              : "audio/mpeg";
    return new Response(stream, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${track.slug}${extension}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
