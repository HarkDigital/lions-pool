import type { NextConfig } from "next";

// Server build behind the Clerk gate, self-hosted on the VPS under pm2.
// "standalone" emits a minimal server bundle (.next/standalone) that deploys
// by rsync with no node_modules install on the box.
const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
