// Supabase Edge Function "import-item-images" (Deno). Copies item pictures into the public `forge-images` bucket.
// Ran once on 18 Nov 2026 for the items added after Version 1.10, then the deployed function was switched off (it
// now answers 410 and touches nothing). To use it again: edit ITEMS, deploy this file as "import-item-images"
// (verify_jwt off), open https://<project>.supabase.co/functions/v1/import-item-images once, read the report, add the
// saved keys to data/images.json, then deploy the switched-off version below the line again.
// The list is fixed (no request input is used) and uploads are upserts, so running it twice changes nothing.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "forge-images";
const TFG = "https://www.theforge.gg/";

const ITEMS: { path: string; urls?: string[]; wiki?: string }[] = [
  { path: "weapons/devils-deed", urls: [TFG + "img/w/devils-deed.webp"] },
  { path: "weapons/moon-crescent-spear", urls: [TFG + "img/w/moon-crescent-spear.webp"] },
  { path: "weapons/royal-guardians-glaive", urls: [TFG + "img/w/royal-guardians-glaive.webp"] },
  { path: "weapons/fangtian", urls: [TFG + "img/g/weapon-fangtian.webp"] },
  { path: "weapons/spiked-halberd", urls: [TFG + "img/g/weapon-spiked-halberd.webp"] },
  { path: "weapons/knights-bulwark", urls: [TFG + "img/g/weapon-knights-bulwark.webp"] },
  { path: "weapons/rosethorn", urls: [TFG + "img/g/weapon-rosethorn.webp"] },
  { path: "armour/juggernauts-chestplate", urls: [TFG + "img/w/juggernautchest.webp"] },
  { path: "armour/juggernauts-leggings", urls: [TFG + "img/w/juggernautlegs.webp"] },
  ...["gloomwardens", "voidstriders", "dreadhorns"].flatMap((set) =>
    ["helmet", "chestplate", "leggings"].map((slot) => ({ path: `armour/${set}-${slot}`, urls: [`${TFG}img/g/armor-${set}-${slot}.webp`] }))),
  // The wiki didn't answer from Supabase on 18 Nov, so these two weren't saved.
  { path: "ores/royal-boneite", wiki: "Royal Boneite" },
  { path: "ores/rainbow-crystal", wiki: "Rainbow Crystal" },
];

async function wikiImage(title: string): Promise<string | null> {
  const api = `https://forgewiki.org/w/api.php?action=query&prop=pageimages&piprop=original&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  const r = await fetch(api, { headers: { "user-agent": "forge-calculator-image-import" } });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.query?.pages?.[0]?.original?.source ?? null;
}

const EXT: Record<string, string> = { "image/webp": "webp", "image/png": "png" };

Deno.serve(async () => {
  const report: Record<string, string> = {};
  for (const item of ITEMS) {
    try {
      const urls = item.urls ?? [];
      if (item.wiki) { const u = await wikiImage(item.wiki); if (u) urls.push(u); }
      for (const url of urls) {
        const res = await fetch(url, { headers: { "user-agent": "forge-calculator-image-import" } });
        const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
        if (!res.ok || !EXT[type]) { report[item.path] = `skipped ${url}: ${res.status} ${type}`; continue; }
        const body = new Uint8Array(await res.arrayBuffer());
        const key = `${item.path}.${EXT[type]}`;
        const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
          method: "POST",
          headers: { authorization: `Bearer ${SERVICE_KEY}`, "content-type": type, "x-upsert": "true", "cache-control": "31536000" },
          body,
        });
        report[item.path] = up.ok ? `saved ${key} (${body.length} bytes) from ${url}` : `upload failed ${up.status}: ${(await up.text()).slice(0, 200)}`;
        if (up.ok) break;
      }
      if (!urls.length) report[item.path] = "no source found";
    } catch (e) {
      report[item.path] = `error: ${String(e).slice(0, 200)}`;
    }
  }
  return new Response(JSON.stringify(report, null, 2), { headers: { "content-type": "application/json" } });
});

// ---------------------------------------------------------------- the switched-off version deployed now (verify_jwt on)
// Deno.serve(() => new Response(JSON.stringify({ active: false, message: "This image importer is switched off." }),
//   { status: 410, headers: { "content-type": "application/json" } }));
