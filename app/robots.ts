import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Search engines may read every public page; account pages are kept out (they also say noindex). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/auth/", "/settings", "/forger", "/login", "/u/", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
