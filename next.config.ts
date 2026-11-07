import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["exceljs", "playwright-core"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
