import type { NextConfig } from "next";

// On GitHub Pages the site lives at https://<user>.github.io/<repo>/ — the
// deploy workflow sets NEXT_PUBLIC_BASE_PATH=/<repo>. Locally it stays "".
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
