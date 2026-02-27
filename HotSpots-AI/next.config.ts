import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.API_URL
          ? `${process.env.API_URL}/api/:path*`
          : 'http://127.0.0.1:8000/api/:path*',
      },
    ];
  },
  // Turbopack configuration
  turbopack: {},
  // Skip TypeScript type checking errors for unresolved libraries
  typescript: {
    tsconfigPath: './tsconfig.json',
    // Only check errors in our source code, not node_modules
  },
};

export default nextConfig;
