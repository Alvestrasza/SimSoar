import type {NextConfig} from "next";
import createNextIntlPlugin from "next-intl/plugin";

const bulkUploadBodySizeLimit = (process.env.MAX_IGC_BULK_BODY_SIZE ??
  "55mb") as `${number}${"kb" | "mb" | "gb"}`;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: process.env.SERVER_ACTION_ALLOWED_ORIGINS
        ? process.env.SERVER_ACTION_ALLOWED_ORIGINS.split(",")
        : [],
      bodySizeLimit: bulkUploadBodySizeLimit
    }
  }
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
