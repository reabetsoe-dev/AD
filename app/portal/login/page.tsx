import { Login } from "@/components/login";
import { currentUser } from "@/lib/security";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Portal Login",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentUser();
  if (user) redirect(user.role === "SECRETARY_GENERAL" ? "/portal" : "/admin");
  return <Login demo={process.env.DEMO_MODE === "true"} />;
}
