import { db } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/security";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const doc = await db.content.findFirst({
      where: {
        id: (await context.params).id,
        kind: "documents",
        isPublished: true,
      },
    });
    if (!doc) throw new HttpError(404, "Document not found.");
    return new Response(doc.body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": "attachment; filename=ad-document.txt",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
