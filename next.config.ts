import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'postgres'],
  // allow dev access via 127.0.0.1 (Next 16 blocks non-localhost dev origins)
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
