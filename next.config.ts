import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: process.env.SERVER_ACTION_ALLOWED_ORIGINS
        ? process.env.SERVER_ACTION_ALLOWED_ORIGINS.split(",")
        : [],
      bodySizeLimit: "10mb"
    }
  }
};

export default nextConfig;
