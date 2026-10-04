import { extname } from "node:path";
import { db } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/security";
import { storage } from "@/lib/storage";
import { mimeTypeForExtension } from "@/lib/upload-rules";

function fileName(title: string, extension: string) {
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${safeTitle || "ad-attachment"}${extension}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const doc = await db.content.findFirst({
      where: {
        id: (await context.params).id,
        kind: { in: ["documents", "manifesto", "events", "media"] },
        isPublished: true,
      },
    });
    if (!doc) throw new HttpError(404, "Attachment not found.");
    if (doc.storageKey) {
      const extension = extname(doc.storageKey).toLowerCase();
      return new Response(await storage.stream(doc.storageKey), {
        headers: {
          "Content-Type": mimeTypeForExtension(extension),
          "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName(
            doc.title,
            extension,
          )}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return new Response(doc.body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename=ad-document.txt`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
