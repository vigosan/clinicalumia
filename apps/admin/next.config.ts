import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clinicalumia/ui"],
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
