import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { can, type Permission } from "./permissions";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { assignedConstituency: true },
  });
  return user && !user.disabled ? user : null;
}
export async function requireUser(permission?: Permission) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  if (permission && !can(user.role, permission))
    throw new HttpError(403, "You do not have permission for this action.");
  return user;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(process.env.APP_URL || request.url).origin)
    throw new HttpError(403, "Request origin is not allowed.");
}
export function assertDemo() {
  if (
    process.env.DEMO_MODE !== "true" ||
    process.env.PAYMENT_PROVIDER !== "mock-mpesa"
  )
    throw new HttpError(503, "Real payments are not configured.");
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && "issues" in error)
    return Response.json(
      { error: "Please check the required fields." },
      { status: 400 },
    );
  if (error instanceof Error && "code" in error && error.code === "P2002")
    return Response.json(
      { error: "That record already exists." },
      { status: 409 },
    );
  console.error(error);
  return Response.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
