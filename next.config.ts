import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  outputFileTracingExcludes: {
    "*": [".demo/**/*", "private-storage/**/*", ".env", ".env.*"],
  },
  outputFileTracingIncludes: {
    "/api/internal/*": ["./public/ad-logo.png"],
  },
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; media-src 'self' https: http:; connect-src 'self' https://blob.vercel-storage.com https://*.blob.vercel-storage.com; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
      ...["/admin/:path*", "/portal/:path*", "/api/internal/:path*"].map(
        (source) => ({
          source,
          headers: [
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
            { key: "Cache-Control", value: "private, no-store" },
          ],
        }),
      ),
    ];
  },
};
export default config;
