import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Sharp is a native module loaded lazily (src/lib/image-processing.ts).
  // Keeping it external prevents Next from bundling/tracing the prebuilt
  // binary into server chunks and loading it during build/page-data
  // collection, which crashes on x86-64-v1 CPUs (no SSE4.2).
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
