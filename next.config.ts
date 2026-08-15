import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a standalone server bundle — handy for containerized / serverless deploys.
  output: "standalone",
};

export default nextConfig;
