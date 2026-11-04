import { describe, expect, it, vi } from "vitest";
import data from "../data/catalogue.json";
import type { Catalogue, Mix } from "../lib/engine/forge";
import { evaluateForge } from "../lib/engine/forge-eval";
import { combatDps } from "../lib/engine/loadout-dps";
import { golemite } from "../lib/engine/golemite";
import { forgeCombat, work } from "../lib/forge-stats";
import { KEY_FORMAT, readKey, sha256, type Auth, type Authorizer, type Scope } from "../lib/api/auth";
import { ApiError } from "../lib/api/errors";
import { getCatalogueEndpoint, postCalculateEndpoint, type Endpoint } from "../lib/api/endpoints";
import { MAX_BODY_BYTES } from "../lib/api/http";
import { calculate } from "../lib/api/calculate";
import { CalculateRequest } from "../lib/api/schema";
import type { SavedForge } from "../lib/saved-forges";

const cat = data as unknown as Catalogue;
const ore = (id: string) => cat.ores.find((o) => o.id === id)!;
const mix = (...pairs: [string, number][]): Mix => pairs.map(([id, count]) => ({ ore: ore(id), count }));

/* ------------------------------------------------------------------ a fake key store with the database's rules */

type FakeKey = { secret: string; id: string; scopes: Scope[]; revoked?: boolean; expires?: number; rpm?: number };
const secret = (c: string) => `fc_live_${c.repeat(43).slice(0, 43)}`;

function fakeStore(keys: FakeKey[]) {
  const hits = new Map<string, number>();
  const finished: { status: number; errorCode: string | null }[] = [];
  const lookups = vi.fn();
  const authorizer: Authorizer = {
    async authorize(req: Request, scope: Scope): Promise<Auth> {
      const key = readKey(req);
      if (!key) throw new ApiError("MISSING_API_KEY");
      lookups(sha256(key));
      const k = keys.find((x) => sha256(x.secret) === sha256(key));
      if (!k) throw new ApiError("INVALID_API_KEY");
      if (k.revoked) throw new ApiError("API_KEY_REVOKED");
      if (k.expires != null && k.expires <= Date.now()) throw new ApiError("API_KEY_EXPIRED");
      if (!k.scopes.includes(scope)) throw new ApiError("INSUFFICIENT_SCOPE");
      const n = (hits.get(k.id + scope) ?? 0) + 1;
      hits.set(k.id + scope, n);
      const limit = k.rpm ?? 60;
      if (n > limit) throw new ApiError("RATE_LIMITED", undefined, undefined, 30);
      return { keyId: k.id, limit, remaining: limit - n, reset: 30, logId: n, logToken: "t" };
    },
    async finish(f) { finished.push({ status: f.status, errorCode: f.errorCode }); },
  };
  const tasks: (() => Promise<void>)[] = [];
  const deps: Endpoint = { authorizer, schedule: (t) => tasks.push(t), now: () => 0, catalogue: async () => cat };
  return { deps, finished, lookups, flush: async () => { for (const t of tasks.splice(0)) await t(); } };
}

const BOT = secret("a"), CAT_ONLY = secret("b"), REVOKED = secret("c"), EXPIRED = secret("d"), OTHER = secret("e");
const KEYS: FakeKey[] = [
  { secret: BOT, id: "bot", scopes: ["catalogue:read", "calculator:execute"] },
  { secret: CAT_ONLY, id: "cat", scopes: ["catalogue:read"] },
  { secret: REVOKED, id: "rev", scopes: ["catalogue:read", "calculator:execute"], revoked: true },
  { secret: EXPIRED, id: "exp", scopes: ["catalogue:read", "calculator:execute"], expires: Date.now() - 1000 },
  { secret: OTHER, id: "other", scopes: ["calculator:execute"], rpm: 2 },
];

const get = (path: string, key?: string, headers: Record<string, string> = {}) =>
  new Request(`https://example.test${path}`, { headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...headers } });
const post = (body: unknown, key?: string, headers: Record<string, string> = {}) =>
  new Request("https://example.test/api/v1/calculate", {
    method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}), ...headers },
  });
const json = async (r: Response) => JSON.parse(await r.text());

/* ------------------------------------------------------------------ keys */

describe("API keys", () => {
  it("accept a valid key and report the rate limit in headers", async () => {
    const { deps } = fakeStore(KEYS);
    const r = await getCatalogueEndpoint(get("/api/v1/catalogue?type=races", BOT), deps);
    expect(r.status).toBe(200);
    expect(r.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(r.headers.get("X-Request-Id")).toMatch(/^req_/);
    const b = await json(r);
    expect(b).toMatchObject({ success: true, apiVersion: "v1", catalogueRevision: (cat as { revision?: number }).revision });
  });

  it("refuse missing, wrong, revoked and expired keys with 401 and their own codes", async () => {
    const { deps } = fakeStore(KEYS);
    const codes = [];
    for (const key of [undefined, secret("z"), REVOKED, EXPIRED]) {
      const r = await getCatalogueEndpoint(get("/api/v1/catalogue", key), deps);
      expect(r.status).toBe(401);
      codes.push((await json(r)).error.code);
    }
    expect(codes).toEqual(["MISSING_API_KEY", "INVALID_API_KEY", "API_KEY_REVOKED", "API_KEY_EXPIRED"]);
  });

  it("refuse a malformed key without looking it up", async () => {
    const { deps, lookups } = fakeStore(KEYS);
    for (const h of ["Bearer nope", "Basic abc", `Bearer ${BOT} extra`, "Bearer fc_live_short"]) {
      const r = await getCatalogueEndpoint(get("/api/v1/catalogue", undefined, { Authorization: h }), deps);
      expect(r.status).toBe(401);
    }
    expect(lookups).not.toHaveBeenCalled();
  });

  it("refuse a key without the endpoint's scope with 403", async () => {
    const { deps } = fakeStore(KEYS);
    const r = await postCalculateEndpoint(post({ type: "golemite", ores: [{ id: "lucky-cat", count: 10 }] }, CAT_ONLY), deps);
    expect(r.status).toBe(403);
    expect((await json(r)).error.code).toBe("INSUFFICIENT_SCOPE");
  });

  it("count each key separately and answer 429 with Retry-After over the limit", async () => {
    const { deps } = fakeStore(KEYS);
    const body = { type: "golemite", ores: [{ id: "lucky-cat", count: 10 }] };
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await postCalculateEndpoint(post(body, OTHER), deps)).status);
    expect(statuses).toEqual([200, 200, 429]);
    const limited = await postCalculateEndpoint(post(body, OTHER), deps);
    expect(limited.headers.get("Retry-After")).toBe("30");
    expect((await postCalculateEndpoint(post(body, BOT), deps)).status).toBe(200); // another key isn't affected
  });

  it("never sends a key back, in success or error responses", async () => {
    const { deps } = fakeStore(KEYS);
    for (const r of [await getCatalogueEndpoint(get("/api/v1/catalogue?type=ores", BOT), deps), await postCalculateEndpoint(post("{bad", BOT), deps),
      await getCatalogueEndpoint(get("/api/v1/catalogue", REVOKED), deps)]) {
      const text = await r.text();
      for (const k of [BOT, REVOKED, sha256(BOT), sha256(REVOKED)]) expect(text).not.toContain(k);
    }
  });

  it("logs each authorised request's final status after responding", async () => {
    const { deps, finished, flush } = fakeStore(KEYS);
    await postCalculateEndpoint(post({ type: "nope" }, BOT), deps);
    expect(finished).toEqual([]);
    await flush();
    expect(finished).toEqual([{ status: 422, errorCode: "VALIDATION_ERROR" }]);
  });

  it("answers 503 when the key store can't be reached", async () => {
    const { deps } = fakeStore(KEYS);
    const down: Endpoint = { ...deps, authorizer: { authorize: async () => { throw new ApiError("SERVICE_UNAVAILABLE"); }, finish: async () => {} } };
    const r = await getCatalogueEndpoint(get("/api/v1/catalogue", BOT), down);
    expect(r.status).toBe(503);
  });

  it("generated keys match the format the server accepts", () => {
    expect(KEY_FORMAT.test(BOT)).toBe(true);
    expect(KEY_FORMAT.test("fc_live_" + "A".repeat(42))).toBe(false);
  });
});

/* ------------------------------------------------------------------ catalogue */

describe("GET /api/v1/catalogue", () => {
  it("returns every section, or one type filtered by world, ids or search", async () => {
    const { deps } = fakeStore(KEYS);
    const all = (await json(await getCatalogueEndpoint(get("/api/v1/catalogue", BOT), deps))).data;
    expect(Object.keys(all).sort()).toEqual(["armour", "classes", "golemites", "molds", "ores", "pickaxes", "races", "runeSideEffects", "runeSlots", "runes", "weapons"]);
    const w4 = (await json(await getCatalogueEndpoint(get("/api/v1/catalogue?type=ores&world=4", BOT), deps))).data;
    expect(Object.keys(w4)).toEqual(["ores"]);
    expect(w4.ores.every((o: { worlds: number[] }) => o.worlds.includes(4))).toBe(true);
    const one = (await json(await getCatalogueEndpoint(get("/api/v1/catalogue?type=ores&ids=bismuth,galaxite", BOT), deps))).data.ores;
    expect(one.map((o: { id: string }) => o.id).sort()).toEqual(["bismuth", "galaxite"]);
    const search = (await json(await getCatalogueEndpoint(get("/api/v1/catalogue?type=weapons&search=gaunt", BOT), deps))).data.weapons;
    expect(search.some((w: { id: string }) => w.id === "dark-knights-gauntlets")).toBe(true);
  });

  it("describes an ore for a Discord card: traits per equipment type, average ores, unknown drops as null", async () => {
    const { deps } = fakeStore(KEYS);
    const ores = (await json(await getCatalogueEndpoint(get("/api/v1/catalogue?type=ores", BOT), deps))).data.ores;
    const bismuth = ores.find((o: { id: string }) => o.id === "bismuth");
    expect(bismuth.traits.map((t: { appliesTo: string[] }) => t.appliesTo)).toEqual(expect.arrayContaining([["weapon"], ["armour"]]));
    expect(bismuth.hasTraits).toEqual({ weapon: true, armour: true });
    const vanegos = ores.find((o: { id: string }) => o.id === "vanegos");
    expect(vanegos.traits.some((t: { appliesTo: string[] }) => t.appliesTo.length === 2)).toBe(true); // applies to both
    const fichi = ores.find((o: { id: string }) => o.id === "fichilliumorite");
    expect(fichi).toMatchObject({ multiplier: null, multiplierRule: "average" });
    // Unknown drop chances stay null (never 0 or a guess).
    const noDrop = ores.filter((o: { dropChance: unknown }) => o.dropChance === null);
    expect(noDrop.length).toBe(cat.ores.filter((o) => o.drop == null).length);
    expect(bismuth.traitRule).toMatchObject({ minShare: 0.1, fullShare: 0.3 });
  });

  it("gives a weapon's forge worlds and weights", async () => {
    const { deps } = fakeStore(KEYS);
    const w = (await json(await getCatalogueEndpoint(get("/api/v1/catalogue?type=weapons&ids=dark-knights-gauntlets,dagger", BOT), deps))).data.weapons;
    expect(w.find((x: { id: string }) => x.id === "dark-knights-gauntlets").forgeWorlds).toEqual([{ world: 2, weight: 6 }]);
    expect(w.find((x: { id: string }) => x.id === "dagger").forgeWorlds.map((x: { world: number }) => x.world)).toEqual([2, 3]);
  });

  it("answers 304 to a matching If-None-Match, and the ETag changes with the filter", async () => {
    const { deps } = fakeStore(KEYS);
    const first = await getCatalogueEndpoint(get("/api/v1/catalogue?type=ores", BOT), deps);
    const etag = first.headers.get("ETag")!;
    expect(first.headers.get("Cache-Control")).toBe("private, no-cache");
    const again = await getCatalogueEndpoint(get("/api/v1/catalogue?type=ores", BOT, { "If-None-Match": etag }), deps);
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
    const other = await getCatalogueEndpoint(get("/api/v1/catalogue?type=races", BOT), deps);
    expect(other.headers.get("ETag")).not.toBe(etag);
  });

  it("rejects unknown types, worlds and parameters with 422", async () => {
    const { deps } = fakeStore(KEYS);
    for (const q of ["type=dragons", "world=7", "world=abc", "colour=red", "ids=<script>"]) {
      const r = await getCatalogueEndpoint(get(`/api/v1/catalogue?${q}`, BOT), deps);
      expect(r.status, q).toBe(422);
      expect((await json(r)).error.code).toBe("VALIDATION_ERROR");
    }
  });
});

/* ------------------------------------------------------------------ calculate: same numbers as the website */

const run = (body: unknown) => calculate(cat, CalculateRequest.parse(body));

describe("POST /api/v1/calculate: forge", () => {
  const dkg = { type: "forge", kind: "weapon", item: "dark-knights-gauntlets", ores: [{ id: "galaxite", count: 5 }, { id: "kyubite", count: 5 }, { id: "fierce-jade", count: 5 }, { id: "bismuth", count: 1 }] };

  it("matches the calculator page for Dark Knight's Gauntlets, working out World 1–2 from the item", () => {
    const out = run(dkg);
    const page = evaluateForge(cat, { mix: mix(["galaxite", 5], ["kyubite", 5], ["fierce-jade", 5], ["bismuth", 1]), kind: "weapon", world: 2, quality: 1, pick: { id: "dark-knights-gauntlets" } });
    const v = page.selected!.v;
    expect(out.data).toMatchObject({ world: 2, worldLabel: "1–2", worldInferred: true, totalOres: 16, rarity: page.result.rarity });
    if (out.data.type !== "forge") throw new Error();
    expect(out.data.item.stat.value).toBe(v.value);
    expect(out.data.item.chance.overall).toBeCloseTo(v.overall, 4);
    expect(out.data.item.weapon!.dpsAtPlus0).toBeCloseTo(v.dps!.total, 2);
    expect(out.data.item.weapon!.dps!.total).toBeCloseTo(v.dps!.total, 2); // +0, no runes: the same number
    expect(out.data.multiplier).toBeCloseTo(page.result.multiplier!, 4);
    expect(out.data.links.calculator).toContain("v=dark-knights-gauntlets");
  });

  it("recalculates the same recipe at another quality (the Discord buttons)", () => {
    const full = run({ ...dkg, quality: 100 }), half = run({ ...dkg, quality: 50 });
    if (full.data.type !== "forge" || half.data.type !== "forge") throw new Error();
    expect(half.data.item.stat.value).toBeLessThan(full.data.item.stat.value!);
    expect(half.data.item.stat.atFullQuality).toBe(full.data.item.stat.value); // the same item at 100%
    expect(half.data.quality.percent).toBe(50);
    expect(half.data.item.chance.overall).toBe(full.data.item.chance.overall); // quality doesn't change odds
  });

  it("adds enhancement and runes like the calculator, and warns that DPS is an estimate", () => {
    const runes = [{ id: "blast-chip", level: 3, secondaries: ["crit_chance", "lethality", "atk_speed"] }];
    const out = run({ ...dkg, enhancement: 9, runes });
    if (out.data.type !== "forge") throw new Error();
    const page = evaluateForge(cat, { mix: mix(["galaxite", 5], ["kyubite", 5], ["fierce-jade", 5], ["bismuth", 1]), kind: "weapon", world: 2, quality: 1, pick: { id: "dark-knights-gauntlets" } });
    const v = page.selected!.v;
    const expected = combatDps({ weapon: { ores: dkg.ores, raw: v.raw!, interval: v.interval!, cls: "Gauntlets" }, level: 9, runes: [{ id: "blast-chip", level: 3, secondaries: ["crit_chance", "lethality", "atk_speed"] }] });
    expect(out.data.item.weapon!.dps!.total).toBeCloseTo(expected.total, 2);
    expect(out.data.item.enhancement).toMatchObject({ level: 9, multiplier: 1.5, runeSlotsOpen: 3 });
    expect(out.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["ESTIMATED_DPS", "PROC_ENHANCEMENT_UNVERIFIED"]));
  });

  it("gives armour defence and slot, without DPS", () => {
    const out = run({ type: "forge", kind: "armour", item: "dark-knight-chestplate", world: 4, ores: [{ id: "galaxite", count: 10 }, { id: "kyubite", count: 10 }] });
    if (out.data.type !== "forge") throw new Error();
    expect(out.data.item).toMatchObject({ slot: "chestplate", class: "Heavy Chestplate", weapon: null });
    expect(out.data.item.stat.name).toBe("defence");
    expect(out.warnings.map((w) => w.code)).not.toContain("ESTIMATED_DPS");
  });

  it("only calls an item guaranteed with enough verified molds and its class locked", () => {
    const base = { ...dkg, ores: [{ id: "galaxite", count: 15 }] };
    const unlocked = run({ ...base, molds: 70 });
    const locked = run({ ...base, molds: 70, lockClass: true });
    const few = run({ ...base, molds: 35, lockClass: true });
    if (unlocked.data.type !== "forge" || locked.data.type !== "forge" || few.data.type !== "forge") throw new Error();
    expect(unlocked.data.item.molds).toMatchObject({ guaranteed: false, state: "needs-lock" });
    expect(locked.data.item.molds).toMatchObject({ guaranteed: true, needed: 70 });
    expect(locked.data.item.chance.overall).toBe(100);
    expect(few.data.item.molds).toMatchObject({ guaranteed: false, state: "partial", moldScreenChance: 0.25, chancesKnown: false });
    expect(few.warnings.map((w) => w.code)).toContain("MOLD_EFFECT_UNKNOWN");
  });

  it("works out the world from the ores when the item is in more than one, and otherwise asks", () => {
    const fromOres = run({ type: "forge", kind: "weapon", item: "dagger", ores: [{ id: "iron", count: 5 }] });
    expect(fromOres.data).toMatchObject({ world: 2, worldInferred: true });
    expect(fromOres.warnings.map((w) => w.code)).toContain("WORLD_FROM_ORES");
    expect(() => run({ type: "forge", kind: "weapon", item: "mace", ores: [{ id: "iron", count: 5 }] })).toThrow(expect.objectContaining({ code: "WORLD_REQUIRED", details: expect.objectContaining({ worlds: [3, 4] }) }));
    expect(() => run({ type: "forge", kind: "weapon", item: "mace", world: 2, ores: [{ id: "iron", count: 5 }] })).toThrow(expect.objectContaining({ code: "ITEM_NOT_IN_WORLD" }));
    expect(run({ type: "forge", kind: "weapon", item: "mace", world: 3, ores: [{ id: "iron", count: 5 }] }).data).toMatchObject({ world: 3, worldInferred: false });
  });

  it("returns every class and item with detail=full", () => {
    const out = run({ ...dkg, detail: "full" });
    if (out.data.type !== "forge") throw new Error();
    const page = evaluateForge(cat, { mix: mix(["galaxite", 5], ["kyubite", 5], ["fierce-jade", 5], ["bismuth", 1]), kind: "weapon", world: 2, quality: 1 });
    expect(out.data.classes!.map((c) => c.chance)).toEqual(page.result.classes.map((c) => c.probability));
    expect(out.data.classes!.flatMap((c) => c.items.map((i) => i.id))).toEqual(page.result.classes.flatMap((c) => c.variants.map((v) => v.id)));
  });
});

describe("POST /api/v1/calculate: dps, loadout and golemite", () => {
  const forgeRow = (id: string, kind: "weapon" | "armour", world: 2 | 3 | 4, cls: string, variant: string, ores: { id: string; count: number }[], quality = 100): SavedForge =>
    ({ id, name: id, kind, world, class_name: cls, variant_id: variant, quality, ores, catalogue_revision: null, created_at: "", enhance: null, runes: null });

  it("gives the same full-loadout DPS as the Profile for the same pieces", () => {
    const oreById = new Map(cat.ores.map((o) => [o.id, o]));
    const wOres = [{ id: "galaxite", count: 5 }, { id: "kyubite", count: 5 }, { id: "fierce-jade", count: 5 }, { id: "bismuth", count: 1 }];
    const hOres = [{ id: "vanegos", count: 10 }];
    const weapon = forgeRow("w", "weapon", 2, "Gauntlets", "dark-knights-gauntlets", wOres);
    const helmet = forgeRow("h", "armour", 4, "Heavy Helmet", "dark-knight-helmet", hOres);
    const profile = forgeCombat({ f: weapon, r: work(cat, oreById, weapon) }, [{ f: helmet, r: work(cat, oreById, helmet) }, null, null], "kitsune")!;
    const out = run({ type: "loadout", weapon: { item: "dark-knights-gauntlets", ores: wOres }, helmet: { item: "dark-knight-helmet", ores: hOres }, race: "kitsune" });
    if (out.data.type !== "loadout") throw new Error();
    expect(out.data.dps!.total).toBeCloseTo(profile.total, 2);
    expect(out.data.armour[0]).toMatchObject({ slot: "helmet", defence: work(cat, oreById, helmet).value });
    const dps = run({ type: "dps", weapon: { item: "dark-knights-gauntlets", ores: wOres }, armour: [{ ores: hOres }], race: "kitsune" });
    if (dps.data.type !== "dps") throw new Error();
    expect(dps.data.dps.total).toBeCloseTo(profile.total, 2);
  });

  it("keeps conditions out of the normal DPS and shows them separately", () => {
    const body = { type: "dps", weapon: { item: "dark-knights-gauntlets", ores: [{ id: "galaxite", count: 15 }] }, race: "orc-lord" };
    const plain = run(body), stacked = run({ ...body, conditions: { orcLordKills: 5 } });
    if (plain.data.type !== "dps" || stacked.data.type !== "dps") throw new Error();
    expect(stacked.data.dps.total).toBe(plain.data.dps.total);
    expect(stacked.data.dps.scenarios.withConditions!).toBeGreaterThan(plain.data.dps.total);
    expect(plain.warnings.map((w) => w.code)).toContain("SITUATIONAL_BONUSES_OFF");
  });

  it("gives a Golemite the game's card values and no damage figure", () => {
    const out = run({ type: "golemite", ores: [{ id: "lucky-cat", count: 10 }], level: 13 });
    if (out.data.type !== "golemite") throw new Error();
    const g = golemite(mix(["lucky-cat", 10]));
    expect(out.data).toMatchObject({ name: "Lucky Cat Golemite", class: "Golem", rarity: "Epic", miningHelp: 0.23, oreTraitShare: 0.15, storage: 50 });
    expect(out.data.rarity).toBe(g.rarity);
    expect(out.data.growth).toMatchObject({ level: 13, canFight: true });
    expect(out.data.combat).toMatchObject({ status: "unknown", damage: null });
  });
});

/* ------------------------------------------------------------------ validation and abuse */

describe("POST /api/v1/calculate: bad input", () => {
  const send = async (body: unknown, headers?: Record<string, string>) => {
    const { deps } = fakeStore(KEYS);
    const r = await postCalculateEndpoint(post(body, BOT, headers), deps);
    return { status: r.status, body: await json(r) };
  };
  const ok = { type: "forge", kind: "weapon", world: 4, ores: [{ id: "galaxite", count: 5 }] };

  it("rejects bad shapes and values with 422 and says where", async () => {
    const cases: unknown[] = [
      { ...ok, ores: [{ id: "galaxite", count: -1 }] },
      { ...ok, ores: [{ id: "galaxite", count: 2.5 }] },
      { ...ok, ores: [{ id: "galaxite", count: 1e309 }] },
      { ...ok, ores: [{ id: "galaxite", count: 2 }, { id: "galaxite", count: 3 }] },
      { ...ok, ores: ["a", "b", "c", "d", "e"].map((c) => ({ id: `ore-${c}`, count: 1 })) },
      { ...ok, world: 5 },
      { ...ok, quality: 0 },
      { ...ok, enhancement: 10 },
      { ...ok, extra: true },
      { ...ok, ores: [{ id: "Galaxite!", count: 5 }] },
      { type: "golemite", ores: [{ id: "lucky-cat", count: 51 }] },
      { type: "teleport" },
      [],
    ];
    for (const c of cases) {
      const r = await send(c);
      expect(r.status, JSON.stringify(c)).toBe(422);
      expect(r.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects unknown IDs with their own codes", async () => {
    expect((await send({ ...ok, ores: [{ id: "unobtainium", count: 5 }] })).body.error.code).toBe("INVALID_ORE");
    expect((await send({ ...ok, item: "excalibur-2" })).body.error.code).toBe("INVALID_ITEM");
    expect((await send({ ...ok, kind: "armour", item: "dark-knights-gauntlets" })).body.error.code).toBe("ITEM_KIND_MISMATCH");
    expect((await send({ type: "dps", weapon: { item: "dark-knights-gauntlets", ores: [{ id: "galaxite", count: 5 }] }, race: "dragon" })).body.error.code).toBe("INVALID_RACE");
    expect((await send({ ...ok, runes: [{ id: "blast-chip", level: 1, secondaries: ["crit_chance", "lethality"] }] })).body.error.code).toBe("INVALID_RUNE");
    expect((await send({ ...ok, ores: [{ id: "galaxite", count: 2 }] })).body.error.code).toBe("NOT_ENOUGH_ORES");
  });

  it("rejects malformed JSON (400), other content types (415) and big bodies (413)", async () => {
    expect((await send("{not json")).status).toBe(400);
    expect((await send(ok, { "Content-Type": "text/plain" })).status).toBe(415);
    const big = { ...ok, padding: "x".repeat(MAX_BODY_BYTES) };
    expect((await send(big)).status).toBe(413);
  });

  it("hides unexpected server errors behind a generic 500", async () => {
    const { deps } = fakeStore(KEYS);
    const broken: Endpoint = { ...deps, catalogue: async () => { throw new Error("database password is hunter2"); } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await postCalculateEndpoint(post(ok, BOT), broken);
    spy.mockRestore();
    const text = await r.text();
    expect(r.status).toBe(500);
    expect(text).not.toContain("hunter2");
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
  });
});
