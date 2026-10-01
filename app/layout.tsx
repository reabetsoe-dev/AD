import type { Metadata } from "next";
import { PlatformProvider } from "@/components/platform-provider";
import { PublicShell } from "@/components/public-shell";
import { publicTracks } from "@/lib/public-data";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://127.0.0.1:3000"),
  title: {
    default: "Alliance of Democrats | AD Digital Platform",
    template: "%s | Alliance of Democrats",
  },
  description:
    "Alliance of Democrats, Lesotho. Media, resources and constituency services.",
  icons: { icon: "/ad-logo.png" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Alliance of Democrats | AD Digital Platform",
    description: "Media, resources and constituency services.",
    images: ["/ad-logo.png"],
  },
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tracks = await publicTracks();
  return (
    <html lang="en">
      <body>
        <PlatformProvider tracks={tracks}>
          <PublicShell>{children}</PublicShell>
        </PlatformProvider>
      </body>
    </html>
  );
}
