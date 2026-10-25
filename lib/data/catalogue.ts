import "server-only";
import bundled from "@/data/catalogue.json";
import type { Catalogue } from "@/lib/engine/forge";
import { SUPABASE_KEY, SUPABASE_URL } from "./supabase";

export { DATA_DATE, imageUrl } from "./supabase";
export const bundledCatalogue = bundled as unknown as Catalogue;

function looksValid(c: unknown): c is Catalogue {
  const x = c as Catalogue;
  return !!x && Array.isArray(x.ores) && x.ores.length > 50 && Array.isArray(x.weapons) && Array.isArray(x.armour) && !!x.odds?.weapon?.["55"] && !!x.odds?.armour?.["55"] && !!x.weaponPools?.["4"];
}

const revisionOf = (c: unknown) => Number((c as { revision?: number })?.revision) || 0;

/**
 * Newest game data: the latest Supabase release (cached for an hour), unless the copy bundled with this
 * deploy is newer (a deploy can land before its data is published) or Supabase is unreachable.
 */
export async function getCatalogue(): Promise<Catalogue> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/catalogue_releases?select=data&order=id.desc&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const rows = (await res.json()) as { data: unknown }[];
      const remote = rows[0]?.data;
      if (looksValid(remote) && revisionOf(remote) >= revisionOf(bundled)) return remote;
    }
  } catch { /* fall back */ }
  return bundledCatalogue;
}
