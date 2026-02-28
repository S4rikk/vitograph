import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["vg.sanderok.uk", "localhost:3000"],
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/profiles/:path*",
        destination: "http://localhost:8000/api/v1/profiles/:path*", // Proxy to Python FastAPI
      },
      {
        source: "/api/v1/analytics/:path*",
        destination: "http://localhost:8000/api/v1/analytics/:path*", // Proxy to Python FastAPI
      },
      {
        source: "/api/v1/users/:path*",
        destination: "http://localhost:8000/api/v1/users/:path*", // Proxy to Python FastAPI
      },
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:3001/api/v1/:path*", // Proxy to Node.js Backend
      },
    ];
  },
  serverExternalPackages: ["@prisma/client", "bcrypt"],
};

export default nextConfig;
