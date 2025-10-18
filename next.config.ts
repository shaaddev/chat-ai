import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: ["mdx", "ts", "tsx"],
  experimental: {
    mdxRs: false,
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-avatar",
      "@radix-ui/react-button",
      "@radix-ui/react-label",
      "@radix-ui/react-separator",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-slot",
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60,
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [],
  },
});

export default withMDX(nextConfig);
