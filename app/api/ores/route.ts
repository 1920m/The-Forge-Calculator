import { publicDataConfig } from "@/lib/data/config";
import { loadOres } from "@/lib/data/ores";

export async function GET() {
  const config = publicDataConfig({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  const catalogue = await loadOres(config);
  return Response.json({
    ...catalogue,
    attribution: { title: "The Forge Official Roblox Wiki contributors", url: "https://forgewiki.org/wiki/Ores", license: "https://creativecommons.org/licenses/by-sa/4.0/" },
    notices: ["Unknown worlds and wiki-only materials remain Unverified.", "Null forgeable means eligibility is unknown."]
  }, { headers: { "Cache-Control": catalogue.source === "supabase" ? "public, s-maxage=300, stale-while-revalidate=600" : "public, s-maxage=30" } });
}
