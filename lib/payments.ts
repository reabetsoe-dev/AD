import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
import { assertDemo, HttpError } from "./security";
export interface PaymentEvent {
  reference: string;
  purchaseId: string;
  amount: string;
  currency: string;
  status: "SUCCESSFUL" | "FAILED";
  timestamp: number;
}
export interface PaymentProvider {
  initiatePayment(purchaseId: string): Promise<{ reference: string }>;
  verifyPayment(event: PaymentEvent, signature: string): boolean;
  handleCallback(event: PaymentEvent, signature: string): Promise<void>;
  getTransactionStatus(reference: string): Promise<string>;
}
export const customerHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export class MockMpesaProvider implements PaymentProvider {
  async initiatePayment(purchaseId: string) {
    assertDemo();
    return { reference: `DEMO-MPESA-${purchaseId}-${randomUUID()}` };
  }
  sign(event: PaymentEvent) {
    assertDemo();
    const secret = process.env.PAYMENT_CALLBACK_SECRET;
    if (!secret || secret.length < 32)
      throw new Error("Payment callback secret is missing.");
    return createHmac("sha256", secret)
      .update(JSON.stringify(event))
      .digest("hex");
  }
  verifyPayment(event: PaymentEvent, signature: string) {
    const expected = Buffer.from(this.sign(event), "hex"),
      actual = Buffer.from(signature, "hex");
    return (
      Math.abs(Date.now() - event.timestamp) < 300000 &&
      actual.length === expected.length &&
      timingSafeEqual(expected, actual)
    );
  }
  async handleCallback(event: PaymentEvent, signature: string) {
    assertDemo();
    if (!this.verifyPayment(event, signature))
      throw new HttpError(403, "Payment verification failed.");
    await db.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findUnique({
        where: { providerTransactionId: event.reference },
        include: { purchase: true },
      });
      if (
        !payment ||
        payment.purchaseId !== event.purchaseId ||
        payment.amount.toFixed(2) !== event.amount ||
        payment.currency !== event.currency
      )
        throw new HttpError(400, "Payment details do not match.");
      if (payment.status === "SUCCESSFUL") return;
      const changed = await tx.paymentTransaction.updateMany({
        where: { id: payment.id, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: event.status },
      });
      if (!changed.count) return;
      await tx.musicPurchase.update({
        where: { id: event.purchaseId },
        data: { status: event.status },
      });
      if (event.status === "SUCCESSFUL")
        await tx.downloadEntitlement.upsert({
          where: { purchaseId: event.purchaseId },
          create: { purchaseId: event.purchaseId },
          update: {},
        });
      await tx.auditLog.create({
        data: {
          action:
            event.status === "SUCCESSFUL"
              ? "PAYMENT_VERIFIED"
              : "PAYMENT_FAILED",
          entityType: "MusicPurchase",
          entityId: event.purchaseId,
          metadata: { provider: "DEMO M-PESA", reference: event.reference },
        },
      });
    });
  }
  async getTransactionStatus(reference: string) {
    assertDemo();
    const tx = await db.paymentTransaction.findUnique({
      where: { providerTransactionId: reference },
    });
    return tx?.status || "UNKNOWN";
  }
}
export const paymentProvider = new MockMpesaProvider();
export async function mayDownload(trackId: string, token: string | undefined) {
  const track = await db.track.findFirst({
    where: { id: trackId, isPublished: true, archived: false },
  });
  if (!track) throw new HttpError(404, "Track not found.");
  if (track.downloadType === "PAID") {
    if (!token) throw new HttpError(403, "A verified purchase is required.");
    const entitlement = await db.downloadEntitlement.findFirst({
      where: {
        purchase: {
          trackId,
          customerHash: customerHash(token),
          status: "SUCCESSFUL",
          transaction: { status: "SUCCESSFUL" },
        },
      },
    });
    if (!entitlement)
      throw new HttpError(403, "A verified purchase is required.");
  }
  return track;
}
