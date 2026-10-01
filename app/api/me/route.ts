import { currentUser } from "@/lib/security";
export async function GET() {
  const user = await currentUser();
  return Response.json(user ? { name: user.name, role: user.role } : null, {
    status: user ? 200 : 401,
    headers: { "Cache-Control": "private, no-store" },
  });
}
