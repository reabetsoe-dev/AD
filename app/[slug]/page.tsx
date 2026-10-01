import { notFound, redirect } from "next/navigation";
import { PublicPage } from "@/components/public-pages";
import { publicContent } from "@/lib/public-data";
const routes = [
  "about",
  "leadership",
  "policies",
  "manifesto",
  "candidates",
  "events",
  "media",
  "music",
  "documents",
  "contact",
];
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "news") redirect("/");
  if (!routes.includes(slug)) notFound();
  return <PublicPage slug={slug} content={await publicContent(slug)} />;
}
