import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  // The live server runs from .next in this same directory, so test builds go elsewhere
  // (NEXT_DIST_DIR=.next-verify npm run build) to avoid swapping production on its next restart.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
