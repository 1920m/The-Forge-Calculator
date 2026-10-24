import "server-only";
import bundled from "@/data/catalogue.json";
import type { Catalogue } from "@/lib/engine/forge";
import { SUPABASE_KEY, SUPABASE_URL } from "./supabase";

export { DATA_DATE, imageUrl } from "./supabase";
export const bundledCatalogue = bundled as unknown as Catalogue;

function looksValid(c: unknown): c is Catalogue {
  const x = c as Catalogue;
  return !!x && Array.isArray(x.ores) && x.ores.length > 50 && Array.isArray(x.weapons) && Array.isArray(x.armour) && !!x.odds?.weapon?.["55"] && !!x.odds?.armour?.["55"];
}

/** Newest game-data release from Supabase (cached for an hour), or the bundled copy if Supabase is unreachable. */
export async function getCatalogue(): Promise<Catalogue> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/catalogue_releases?select=data&order=id.desc&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const rows = (await res.json()) as { data: unknown }[];
      if (looksValid(rows[0]?.data)) return rows[0].data;
    }
  } catch { /* fall back */ }
  return bundledCatalogue;
}
