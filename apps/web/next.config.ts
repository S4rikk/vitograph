import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  allowedDevOrigins: ["vg.sanderok.uk", "localhost:3000"],
  reactCompiler: true,
  async rewrites() {
    return [
      { source: "/api/v1/profiles/:path*", destination: "http://localhost:8001/api/v1/profiles/:path*" },
      { source: "/api/v1/analytics/:path*", destination: "http://localhost:8001/api/v1/analytics/:path*" },
      { source: "/api/v1/users/:path*", destination: "http://localhost:8001/api/v1/users/:path*" },
      { source: "/api/v1/test-results/:path*", destination: "http://localhost:8001/api/v1/test-results/:path*" },
      { source: "/api/v1/norms/:path*", destination: "http://localhost:8001/api/v1/norms/:path*" },
      { source: "/api/v1/analysis/:path*", destination: "http://localhost:8001/api/v1/analysis/:path*" },
      { source: "/parse", destination: "http://localhost:8001/parse" },
      { source: "/parse-image", destination: "http://localhost:8001/parse-image" },
      { source: "/calculate", destination: "http://localhost:8001/calculate" },
      { source: "/api/v1/:path*", destination: "http://localhost:3001/api/v1/:path*" },
    ];
  },
  serverExternalPackages: ["@prisma/client", "bcrypt"],
};
export default nextConfig;
