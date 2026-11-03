import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The public pages, for Google Search Console and other search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [["/", 1], ["/builds", 0.8], ["/ores", 0.8], ["/gear", 0.8], ["/races", 0.7], ["/golemite", 0.7], ["/how-it-works", 0.6], ["/privacy", 0.2]];
  return pages.map(([path, priority]) => ({ url: `${SITE_URL}${path}`, changeFrequency: "weekly", priority }));
}
