import type { NextConfig } from "next";

const invoiceAssets = [
  "../../packages/invoices/fonts/**",
  "../../packages/invoices/assets/**",
];

const nextConfig: NextConfig = {
  transpilePackages: ["@clinicalumia/ui", "@clinicalumia/invoices"],
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/facturacion/zip": invoiceAssets,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
