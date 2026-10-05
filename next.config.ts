import path from "node:path";
import type { NextConfig } from "next";

// Pin the project root: a stray lockfile in a parent directory would otherwise
// be picked as the root and nest the standalone output under that path.
const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, used by the Docker image.
  output: "standalone",
  outputFileTracingRoot: root,
  turbopack: { root },
};

export default nextConfig;
