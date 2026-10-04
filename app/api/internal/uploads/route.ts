import { extname } from "node:path";
import { handleUpload } from "@vercel/blob/client";
import { z } from "zod";
import { can } from "@/lib/permissions";
import {
  errorResponse,
  HttpError,
  requireUser,
  sameOrigin,
} from "@/lib/security";
import { isBlobKey } from "@/lib/storage";
import { uploadCategories, uploadRules } from "@/lib/upload-rules";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const body = z
      .object({
        type: z.literal("blob.generate-client-token"),
        payload: z.object({
          pathname: z.string().max(250),
          multipart: z.boolean(),
          clientPayload: z.string().max(250),
        }),
      })
      .parse(await request.json());
    const { category, isPublic } = z
      .object({
        category: z.enum(uploadCategories),
        isPublic: z.boolean(),
      })
      .parse(JSON.parse(body.payload.clientPayload));
    const canManageContentMedia =
      can(user.role, "MANAGE_CONTENT") || can(user.role, "MANAGE_MEDIA");
    const allowed =
      category === "csv"
        ? can(user.role, "SUBMIT_CONSTITUENCY_MEMBERSHIP")
        : category === "audio"
          ? can(user.role, "MANAGE_MUSIC") || canManageContentMedia
          : category === "image"
            ? canManageContentMedia || can(user.role, "MANAGE_MUSIC")
            : category === "document" ||
                category === "video" ||
                category === "archive"
              ? canManageContentMedia
              : false;
    if (!allowed) throw new HttpError(403, "You cannot upload this file type.");
    const rules = uploadRules[category];
    const prefix = `${isPublic ? "public" : "private"}/${category}/${user.id}/`;
    const pathname = body.payload.pathname;
    if (
      (isPublic && !["audio", "image"].includes(category)) ||
      !isBlobKey(pathname) ||
      !pathname.startsWith(prefix) ||
      !rules.extensions.includes(extname(pathname))
    )
      throw new HttpError(400, "Invalid upload path.");
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      throw new HttpError(503, "Cloud storage is not configured.");
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [...rules.types],
        maximumSizeInBytes: rules.limit,
        addRandomSuffix: false,
        allowOverwrite: false,
        validUntil: Date.now() + 15 * 60 * 1000,
      }),
    });
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return errorResponse(new HttpError(400, "Invalid upload request."));
    return errorResponse(error);
  }
}
