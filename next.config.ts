import type { NextConfig } from "next";
import { publicDataConfig } from "./lib/data/config";

const dataConfig = publicDataConfig({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
});

const config: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: dataConfig ? [{ protocol: "https", hostname: dataConfig.imageHost, port: "", pathname: "/storage/v1/object/public/forge-images/**", search: "" }] : []
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
    ] }];
  }
};

export default config;
