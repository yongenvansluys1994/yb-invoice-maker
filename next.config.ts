import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // Increase body size limit for API routes (untuk logo upload)
    // Default Next.js body size limit adalah 1MB
  },
  // Note: Next.js tidak memiliki built-in config untuk body size limit
  // Kita perlu handle di API route level atau gunakan middleware
};

export default nextConfig;
