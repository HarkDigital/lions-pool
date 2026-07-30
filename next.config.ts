import type { NextConfig } from "next";

// Server build behind the Clerk gate, self-hosted on the VPS under pm2.
// "standalone" emits a minimal server bundle (.next/standalone) that deploys
// by rsync with no node_modules install on the box.
const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  images: { unoptimized: true },
  // mysql2 does dynamic requires the file tracer can't follow; keep it external
  // and force-include the whole dep tree so the standalone bundle can require
  // it at runtime.
  serverExternalPackages: ["mysql2"],
  outputFileTracingIncludes: {
    "/api/pool": [
      "./node_modules/mysql2/**/*",
      "./node_modules/aws-ssl-profiles/**/*",
      "./node_modules/denque/**/*",
      "./node_modules/generate-function/**/*",
      "./node_modules/iconv-lite/**/*",
      "./node_modules/safer-buffer/**/*",
      "./node_modules/long/**/*",
      "./node_modules/lru.min/**/*",
      "./node_modules/named-placeholders/**/*",
      "./node_modules/sql-escaper/**/*",
    ],
  },
};

export default nextConfig;
