import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    // In local development, keep `/api/*` proxied to the FastAPI server.
    // In deployed environments, the frontend should call the Azure backend
    // directly via NEXT_PUBLIC_API_URL, which bypasses this rewrite entirely.
    if (process.env.NEXT_PUBLIC_API_URL) return [];
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
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
