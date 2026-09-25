import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clinicalumia/ui"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "clinicalumia.es" }],
        destination: "https://www.clinicalumia.es/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "*.fbcdn.net" },
    ],
  },
};

export default nextConfig;
