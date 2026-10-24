// Public, read-only Supabase settings. The URL and publishable key are designed to be public;
// row-level security only allows reads. Override with env vars for another project.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzvdmthbcmdwwpkoekso.supabase.co").replace(/\/$/, "");
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_plI7PPyu16oYPOPoLFulDA_mDYahcsZ";
import available from "@/data/images.json";

const uploaded = new Set<string>(available as string[]);
export const DATA_DATE = "24 Oct 2026";

/** Public image in the `forge-images` bucket (listed in data/images.json), or null to show the placeholder tile. */
export function imageUrl(folder: "ores" | "weapons" | "armour", id: string): string | null {
  const key = `${folder}/${id}.png`;
  return uploaded.has(key) ? `${SUPABASE_URL}/storage/v1/object/public/forge-images/${key}` : null;
}
