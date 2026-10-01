import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  assertDemo,
  errorResponse,
  HttpError,
  sameOrigin,
} from "@/lib/security";
import {
  customerHash,
  paymentProvider,
  type PaymentEvent,
} from "@/lib/payments";
async function owned(id: string) {
  const token = (await cookies()).get("ad-purchase")?.value;
  if (!token) throw new HttpError(403, "Purchase session is unavailable.");
  const purchase = await db.musicPurchase.findFirst({
    where: { id, customerHash: customerHash(token) },
    include: { transaction: true, entitlement: true },
  });
  if (!purchase || !purchase.transaction)
    throw new HttpError(404, "Purchase not found.");
  return purchase;
}
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const p = await owned((await context.params).id);
    return Response.json(
      { id: p.id, status: p.status, downloadAvailable: !!p.entitlement },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    assertDemo();
    const p = await owned((await context.params).id);
    const { outcome } = z
      .object({ outcome: z.enum(["SUCCESSFUL", "FAILED"]) })
      .parse(await request.json());
    const event: PaymentEvent = {
      reference: p.transaction!.providerTransactionId,
      purchaseId: p.id,
      amount: p.amount.toFixed(2),
      currency: p.currency,
      status: outcome,
      timestamp: Date.now(),
    };
    await paymentProvider.handleCallback(event, paymentProvider.sign(event));
    const updated = await owned(p.id);
    return Response.json({
      id: p.id,
      status: updated.status,
      downloadAvailable: !!updated.entitlement,
      demo: true,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
