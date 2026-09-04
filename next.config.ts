import type {NextConfig} from "next";
import createNextIntlPlugin from "next-intl/plugin";

const serverActionBodySizeLimit = (process.env.MAX_SERVER_ACTION_BODY_SIZE ??
  process.env.MAX_IGC_BULK_BODY_SIZE ?? "110mb") as `${number}${"kb" | "mb" | "gb"}`;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: process.env.SERVER_ACTION_ALLOWED_ORIGINS
        ? process.env.SERVER_ACTION_ALLOWED_ORIGINS.split(",")
        : [],
      bodySizeLimit: serverActionBodySizeLimit
    }
  }
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
