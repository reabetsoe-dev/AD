import { workspaceData } from "@/lib/workspace";
import { Workspace } from "@/components/workspace";
export const metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  return (
    <Workspace
      data={await workspaceData("admin", section?.join("/") || "dashboard")}
    />
  );
}
