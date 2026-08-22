import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next 16 writes AGENTS.md / CLAUDE.md into the repo root on dev start.
  agentRules: false,
  // Keeps the Vercel/Node build simple and portable.
  outputFileTracingIncludes: {
    "/api/**": ["./src/data/**/*"],
  },
};

export default nextConfig;
