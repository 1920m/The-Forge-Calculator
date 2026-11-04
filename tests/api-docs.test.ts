import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import data from "../data/catalogue.json";
import type { Catalogue } from "../lib/engine/forge";
import { buildOpenApi } from "../lib/api/openapi";
import { ERRORS } from "../lib/api/errors";
import { CalculateRequest } from "../lib/api/schema";
import { EXAMPLES, WARNINGS, exampleCatalogue, exampleResponse, shorten, type ExampleType } from "../lib/api/docs";
import { getCatalogueEndpoint, postCalculateEndpoint, type Endpoint } from "../lib/api/endpoints";
import { ApiError } from "../lib/api/errors";
import { readKey } from "../lib/api/auth";
import { ForgeApi, ForgeApiError, autocomplete } from "../public/developers/examples/forge-api";

const cat = data as unknown as Catalogue;

describe("OpenAPI spec", () => {
  const spec = buildOpenApi() as unknown as {
    openapi: string; paths: Record<string, Record<string, { responses: Record<string, { description: string }>; requestBody?: { content: Record<string, { schema: { oneOf: { $ref: string }[] } }> } }>>;
    components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
  };

  it("describes both endpoints", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths).sort()).toEqual(["/calculate", "/catalogue"]);
    expect(spec.paths["/catalogue"].get).toBeTruthy();
    expect(spec.paths["/calculate"].post).toBeTruthy();
  });

  it("has all four calculation types, each defined", () => {
    const refs = spec.paths["/calculate"].post.requestBody!.content["application/json"].schema.oneOf.map((r) => r.$ref.split("/").pop()!);
    expect(refs).toEqual(["ForgeRequest", "DpsRequest", "LoadoutRequest", "GolemiteRequest"]);
    for (const r of refs) expect(spec.components.schemas[r]?.properties?.type).toBeTruthy();
  });

  it("lists every error code the server can send", () => {
    const listed = Object.values(spec.paths).flatMap((p) => Object.values(p)).flatMap((op) => Object.values(op.responses).map((r) => r.description)).join(" ");
    for (const code of Object.keys(ERRORS)) {
      if (code === "NOT_FOUND" || code === "METHOD_NOT_ALLOWED") continue; // not tied to an operation
      expect(listed, code).toContain(`\`${code}\``);
    }
  });

  it("matches the server's limits (spec comes from the same schemas)", () => {
    const forge = JSON.stringify(spec.components.schemas.ForgeRequest);
    expect(forge).toContain('"maxItems":4');
    expect(forge).toContain('"maximum":99');
  });
});

describe("developer page examples", () => {
  it("are valid requests", () => {
    for (const body of Object.values(EXAMPLES)) expect(CalculateRequest.safeParse(body).success).toBe(true);
  });

  it("run through the real engine with the documented numbers", () => {
    const forge = exampleResponse(cat, "forge").data as { multiplier: number; item: { stat: { value: number }; weapon: { dps: { total: number } } } };
    expect(forge.multiplier).toBeCloseTo(19.6667, 4);
    expect(forge.item.stat.value).toBe(393.33);
    expect(forge.item.weapon.dps.total).toBe(2851.87);
    expect((exampleResponse(cat, "dps").data as { dps: { total: number } }).dps.total).toBe(5986.78);
    const golem = exampleResponse(cat, "golemite").data as { name: string; rarity: string; miningHelp: number; oreTraitShare: number };
    expect([golem.name, golem.rarity, golem.miningHelp, golem.oreTraitShare]).toEqual(["Lucky Cat Golemite", "Epic", 0.23, 0.15]);
    for (const t of Object.keys(EXAMPLES) as ExampleType[]) expect(exampleResponse(cat, t).success).toBe(true);
  });

  it("show the catalogue entry for Bismuth with the average rule", () => {
    const ores = (exampleCatalogue(cat).data as { ores: { id: string; multiplier: number | null; multiplierRule: string }[] }).ores;
    expect(ores).toHaveLength(1);
    expect(ores[0]).toMatchObject({ id: "bismuth", multiplier: null, multiplierRule: "average" });
  });

  it("shorten only trims lists", () => {
    expect(shorten({ a: [1, 2, 3, 4, 5], b: { c: [1, 2, 3, 4] }, d: "x" })).toEqual({ a: [1, 2, 3], b: { c: [1, 2, 3] }, d: "x" });
  });

  it("documents every warning the engine can add, and nothing else", () => {
    const src = readFileSync(new URL("../lib/api/calculate.ts", import.meta.url), "utf8");
    const used = [...new Set([...src.matchAll(/code: "([A-Z_]+)"/g)].map((m) => m[1]))].sort();
    expect(Object.keys(WARNINGS).sort()).toEqual(used);
  });
});

/* ------------------------------------------------------------------ the example client against the real endpoint code */

const KEY = `fc_live_${"k".repeat(43)}`;
function wire() {
  const calls: { url: string; status: number }[] = [];
  let left = Infinity;
  const deps: Endpoint = {
    authorizer: {
      async authorize(req) {
        if (readKey(req) !== KEY) throw new ApiError("INVALID_API_KEY");
        if (left-- <= 0) throw new ApiError("RATE_LIMITED", undefined, undefined, 1);
        return { keyId: "k", limit: 60, remaining: 59, reset: 30, logId: 1, logToken: "t" };
      },
      async finish() {},
    },
    schedule: () => {}, now: () => 0, catalogue: async () => cat,
  };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const req = new Request(url, init);
    const res = new URL(url).pathname.endsWith("/catalogue") ? await getCatalogueEndpoint(req, deps) : await postCalculateEndpoint(req, deps);
    calls.push({ url, status: res.status });
    return res;
  });
  return { calls, limitTo: (n: number) => { left = n; } };
}

describe("example client (forge-api.ts)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("refuses something that isn't a key before any request", () => {
    expect(() => new ForgeApi("not-a-key")).toThrow(/API key/);
  });

  it("caches the catalogue and revalidates with ETag (304)", async () => {
    const { calls } = wire();
    const api = new ForgeApi(KEY, "https://x.test/api/v1", 0);
    const first = await api.ores();
    const again = await api.ores();
    expect(again).toBe(first);
    expect(calls.map((c) => c.status)).toEqual([200, 304]);
  });

  it("autocomplete puts names that start with the text first and keeps to 25", async () => {
    wire();
    const ores = await new ForgeApi(KEY, "https://x.test/api/v1").ores();
    const out = autocomplete(ores, "ky");
    expect(out[0].name.toLowerCase().startsWith("ky")).toBe(true);
    expect(out.every((c) => c.name.toLowerCase().includes("ky"))).toBe(true);
    expect(autocomplete(ores, "").length).toBe(25);
  });

  it("returns the same numbers as the API and turns errors into ForgeApiError", async () => {
    wire();
    const api = new ForgeApi(KEY, "https://x.test/api/v1");
    const r = await api.calculate<{ item: { stat: { value: number } } }>(EXAMPLES.forge as never);
    expect(r.data.item.stat.value).toBe(393.33);
    const err = await api.calculate({ type: "forge", kind: "weapon", ores: [{ id: "nope", count: 3 }] }).catch((e) => e);
    expect(err).toBeInstanceOf(ForgeApiError);
    expect([err.status, err.code]).toEqual([422, "INVALID_ORE"]);
    expect(err.requestId).toMatch(/^req_/);
  });

  it("retries once after a short 429", async () => {
    const { calls, limitTo } = wire();
    vi.useFakeTimers();
    limitTo(0);
    const api = new ForgeApi(KEY, "https://x.test/api/v1");
    const p = api.calculate(EXAMPLES.golemite as never).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await p;
    expect(err.code).toBe("RATE_LIMITED");
    expect(calls.map((c) => c.status)).toEqual([429, 429]);
  });
});
