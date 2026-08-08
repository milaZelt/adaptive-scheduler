import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Without this, Turbopack walks up from this directory looking for a
    // lockfile and can pick up an unrelated one further up the filesystem,
    // misdetecting the project root and breaking "@/*" path resolution.
    root: __dirname,
  },
};

export default nextConfig;
