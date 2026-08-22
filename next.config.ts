import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keeps the Vercel/Node build simple and portable.
  outputFileTracingIncludes: {
    "/api/**": ["./src/data/**/*"],
  },
};

export default nextConfig;
