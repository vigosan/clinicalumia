import type { NextConfig } from "next";

const invoiceAssets = [
  "../../packages/invoices/fonts/**",
  "../../packages/invoices/assets/**",
];

const nextConfig: NextConfig = {
  transpilePackages: ["@clinicalumia/ui", "@clinicalumia/invoices"],
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/": invoiceAssets,
    "/facturas/[id]": invoiceAssets,
    "/facturas/[id]/pdf": invoiceAssets,
  },
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
