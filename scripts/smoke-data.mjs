import { existsSync } from "node:fs";
import { publicDataConfig } from "../lib/data/config.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const config = publicDataConfig({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
if (!config || new URL(config.url).hostname !== "jzvdmthbcmdwwpkoekso.supabase.co") throw new Error("Smoke test requires the verified Forge project public configuration.");
const headers = { apikey: config.key };
const expected = { ores:150, ore_traits:62, weapon_types:10, weapons:81, armour_variants:37, armour_pieces:37, category_odds:848, enhancement_levels:11, quality_tiers:9, trait_strength:101, patches:1 };
for (const [table, count] of Object.entries(expected)) {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=*&limit=1000`, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${table}: anonymous read failed (${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== count) throw new Error(`${table}: unexpected public row count.`);
  console.log(`${table}: ${rows.length} anonymous rows`);
}
// A deliberately invalid marker also lacks required fields: it must never be
// written even if a future grant regression occurs. Check permission, not 400.
const denied = await fetch(`${config.url}/rest/v1/ores`, {
  method: "POST", headers: { ...headers, "Content-Type":"application/json" },
  body: JSON.stringify({ slug:"read-only-smoke-check" }), signal: AbortSignal.timeout(15000)
});
const error = await denied.json();
if (![401,403].includes(denied.status) || error.code !== "42501") throw new Error(`Anonymous write did not fail for insufficient privilege (${denied.status}, ${error.code}).`);
console.log(`Anonymous write denied: HTTP ${denied.status}, SQLSTATE ${error.code}`);
