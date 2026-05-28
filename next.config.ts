import type {NextConfig} from "next";
import createNextIntlPlugin from "next-intl/plugin";

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

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);