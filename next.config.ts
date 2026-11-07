import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["exceljs"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
