import snapshot from "./ores.snapshot.json";
import { publicDataConfig } from "./config";

const confidences = ["confirmed", "derived", "assumed", "unknown"] as const;
export type Confidence = typeof confidences[number];
export type OreRecord = {
  slug: string; name: string; rarity: string; multiplier: number | null;
  multiplier_rule: "fixed" | "average-other-ores";
  worlds: number[] | null; world_status: Confidence; forgeable: boolean | null;
  confidence: Confidence; source_url: string; image_path: string | null;
};
const isConfidence = (value: unknown): value is Confidence => confidences.includes(value as Confidence);

/** Reject malformed upstream data rather than silently calculating from it. */
export function parseOreRecords(value: unknown): OreRecord[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Ore catalogue is empty or invalid.");
  const slugs = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object" || typeof row.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || slugs.has(row.slug)
      || typeof row.name !== "string" || !row.name || typeof row.rarity !== "string" || !row.rarity
      || !(row.multiplier === null || (typeof row.multiplier === "number" && Number.isFinite(row.multiplier) && row.multiplier >= 0))
      || !["fixed", "average-other-ores"].includes(row.multiplier_rule)
      || !(row.worlds === null || (Array.isArray(row.worlds) && row.worlds.length > 0 && new Set(row.worlds).size === row.worlds.length && row.worlds.every((world: unknown) => typeof world === "number" && [1,2,3,4].includes(world))))
      || !isConfidence(row.world_status) || !isConfidence(row.confidence)
      || !(row.forgeable === null || typeof row.forgeable === "boolean")
      || typeof row.source_url !== "string" || !row.source_url.startsWith("https://")
      || !(row.image_path === null || (typeof row.image_path === "string" && /^(ores|weapons|armour)\/[a-z0-9/-]+\.(png|webp|jpe?g|avif)$/.test(row.image_path)))) {
      throw new Error("Invalid ore catalogue record.");
    }
    slugs.add(row.slug);
  }
  return value as OreRecord[];
}

type DataConfig = ReturnType<typeof publicDataConfig>;
export async function loadOres(config: DataConfig, request: typeof fetch = fetch) {
  if (config) {
    try {
      const fields = "slug,name,rarity,multiplier,multiplier_rule,worlds,world_status,forgeable,confidence,source_url,image_path";
      const response = await request(`${config.url}/rest/v1/ores?select=${fields}&order=name&limit=1000`, {
        headers: { apikey: config.key }, signal: AbortSignal.timeout(8000),
        next: { revalidate: 3600 }
      });
      if (!response.ok) throw new Error("Catalogue unavailable.");
      const ores = parseOreRecords(await response.json());
      return { source: "supabase" as const, ores };
    } catch {
      // A failed or paused database must not erase the publicly sourced data.
    }
  }
  return { source: "bundled" as const, ores: parseOreRecords(snapshot) };
}
