import { z } from "zod";
import { errorResponse, sameOrigin } from "@/lib/security";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    z.object({
      name: z.string().trim().min(1).max(100),
      email: z.email(),
      message: z.string().trim().min(10).max(2000),
    }).parse(await request.json());
    return Response.json({
      message:
        "Your message is valid. Message delivery is currently unavailable; nothing was sent.",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
