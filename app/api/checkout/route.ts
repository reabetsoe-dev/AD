import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  assertDemo,
  errorResponse,
  HttpError,
  sameOrigin,
} from "@/lib/security";
import { customerHash, paymentProvider } from "@/lib/payments";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    assertDemo();
    const input = z
      .object({
        trackId: z.string(),
        phone: z.string().regex(/^[+0-9 ()-]{8,20}$/),
      })
      .parse(await request.json());
    const track = await db.track.findFirst({
      where: {
        id: input.trackId,
        isPublished: true,
        archived: false,
        downloadType: "PAID",
      },
    });
    if (!track)
      throw new HttpError(404, "This track is unavailable for purchase.");
    const jar = await cookies();
    const token =
      jar.get("ad-purchase")?.value || randomBytes(32).toString("hex");
    const hash = customerHash(token);
    const recent = await db.musicPurchase.count({
      where: {
        customerHash: hash,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });
    if (recent >= 5)
      throw new HttpError(429, "Please wait before starting another payment.");
    const purchase = await db.$transaction(async (tx) => {
      const p = await tx.musicPurchase.create({
        data: {
          trackId: track.id,
          customerHash: hash,
          phoneMasked: `***${input.phone.slice(-3)}`,
          amount: track.price,
          currency: track.currency,
        },
      });
      const started = await paymentProvider.initiatePayment(p.id);
      await tx.paymentTransaction.create({
        data: {
          purchaseId: p.id,
          provider: "MOCK_MPESA",
          providerTransactionId: started.reference,
          amount: track.price,
          currency: track.currency,
        },
      });
      return p;
    });
    jar.set("ad-purchase", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.APP_URL?.startsWith("https://"),
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return Response.json({
      id: purchase.id,
      status: purchase.status,
      demo: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
