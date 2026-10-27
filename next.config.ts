import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without this, a stray lockfile
  // higher up (e.g. ~/package-lock.json) makes Turbopack infer the wrong root
  // and module resolution for PostCSS/Tailwind breaks in dev.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
