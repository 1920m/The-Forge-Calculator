/**
 * Forge Calculator API client (TypeScript / JavaScript, Node 18+). No dependencies: uses the built-in fetch.
 *
 *   const api = new ForgeApi(process.env.FORGE_API_KEY!);
 *   const ores = await api.ores();                                    // cached; refreshed when the data changes
 *   const res = await api.calculate({ type: "forge", kind: "weapon", item: "dark-knights-gauntlets",
 *     ores: [{ id: "galaxite", count: 5 }, { id: "kyubite", count: 5 }], quality: 100 });
 *
 * Keep the key in an environment variable on the server. Never put it in browser code or a public repository.
 */

export const FORGE_API_BASE = "https://the-forge-calculator.vercel.app/api/v1";

export type Warning = { code: string; message: string };
export type Ok<T> = { success: true; apiVersion: string; catalogueRevision: number; dataVersion: string; requestId: string; data: T; warnings?: Warning[]; calculationModelVersion?: string };
export type ApiErrorBody = { success: false; apiVersion: string; error: { code: string; message: string; requestId: string; details?: unknown } };

/** A failed request. `code` is stable (INVALID_ORE, RATE_LIMITED, WORLD_REQUIRED...); `retryAfter` is in seconds. */
export class ForgeApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly requestId: string | null, readonly details?: unknown, readonly retryAfter?: number) {
    super(message);
  }
}

export type OreRef = { id: string; count: number };
export type Rune = { id: string; level: 1 | 2 | 3; secondaries?: string[] } | null;
export type ForgeRequest = { type: "forge"; kind: "weapon" | "armour"; item?: string; world?: 1 | 2 | 3 | 4; ores: OreRef[]; quality?: number; lockClass?: boolean; molds?: number; enhancement?: number; runes?: Rune[]; detail?: "summary" | "full" };
export type Piece = { item: string; ores: OreRef[]; quality?: number };
export type Conditions = { lowHp?: boolean; orcLordMissingHp?: number; orcLordKills?: number; dryadGrove?: boolean; maxHp?: number; kitsuneDodge?: boolean };
export type DpsRequest = { type: "dps"; weapon: Piece; enhancement?: number; runes?: Rune[]; race?: string; armour?: { ores: OreRef[] }[]; conditions?: Conditions };
export type LoadoutRequest = { type: "loadout"; weapon?: Piece; helmet?: Piece; chestplate?: Piece; leggings?: Piece; enhancement?: number; runes?: Rune[]; race?: string; conditions?: Conditions };
export type GolemiteRequest = { type: "golemite"; ores: OreRef[]; quality?: number; level?: number };
export type CalculateRequest = ForgeRequest | DpsRequest | LoadoutRequest | GolemiteRequest;

/* Catalogue entries (the fields the Discord examples use; the API sends more). */
export type Ore = {
  id: string; name: string; rarity: string; image: string | null; multiplier: number | null; multiplierRule: "fixed" | "average";
  worlds: number[]; dropChance: { oneIn: number } | null; foundIn: string | null;
  traits: { text: string; appliesTo: ("weapon" | "armour")[] }[]; hasTraits: { weapon: boolean; armour: boolean };
  traitRule: { minShare: number; fullShare: number; note: string }; verified: boolean;
};
export type Weapon = { id: string; name: string; class: string; image: string | null; forgeWorlds: { world: number; weight: number }[] };
export type Armour = { id: string; name: string; class: string; slot: string; image: string | null; forgeWorlds: { world: number; weight: number }[] };

type Cached<T> = { etag: string | null; body: Ok<T> | null; at: number };

export class ForgeApi {
  private cache = new Map<string, Cached<unknown>>();

  /** `refreshMs`: how often to check for new catalogue data (a cheap 304 when nothing changed). */
  constructor(private readonly key: string, private readonly base = FORGE_API_BASE, private readonly refreshMs = 10 * 60 * 1000, private readonly timeoutMs = 8000) {
    if (!/^fc_live_[A-Za-z0-9_-]{43}$/.test(key)) throw new Error("FORGE_API_KEY is missing or isn't a Forge Calculator API key.");
  }

  private async request<T>(path: string, init: RequestInit = {}, etag?: string | null): Promise<{ status: number; body: Ok<T> | null; etag: string | null }> {
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        ...init,
        headers: { Authorization: `Bearer ${this.key}`, Accept: "application/json", ...(etag ? { "If-None-Match": etag } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new ForgeApiError(0, (e as Error).name === "TimeoutError" ? "TIMEOUT" : "NETWORK_ERROR", "The Forge Calculator API didn't answer. Try again shortly.", null);
    }
    if (res.status === 304) return { status: 304, body: null, etag: etag ?? null };
    const text = await res.text();
    let json: Ok<T> | ApiErrorBody | null = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    if (!res.ok || !json || json.success !== true) {
      const err = (json as ApiErrorBody | null)?.error;
      const retry = Number(res.headers.get("Retry-After")) || undefined;
      throw new ForgeApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? `The API answered ${res.status}.`, err?.requestId ?? res.headers.get("X-Request-Id"), err?.details, retry);
    }
    return { status: res.status, body: json, etag: res.headers.get("ETag") };
  }

  /** Catalogue data, cached in memory and revalidated with ETag every `refreshMs`. */
  async catalogue<T = Record<string, unknown>>(query: Record<string, string | number> = {}): Promise<Ok<T>> {
    const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
    const path = `/catalogue${qs ? `?${qs}` : ""}`;
    const hit = this.cache.get(path) as Cached<T> | undefined;
    if (hit?.body && Date.now() - hit.at < this.refreshMs) return hit.body;
    try {
      const r = await this.request<T>(path, {}, hit?.etag);
      const body = r.status === 304 ? hit!.body! : r.body!;
      this.cache.set(path, { etag: r.etag, body, at: Date.now() });
      return body;
    } catch (e) {
      if (hit?.body) return hit.body; // keep serving the last good copy if the API is briefly down
      throw e;
    }
  }

  async ores(): Promise<Ore[]> { return (await this.catalogue<{ ores: Ore[] }>({ type: "ores" })).data.ores; }
  async weapons(): Promise<Weapon[]> { return (await this.catalogue<{ weapons: Weapon[] }>({ type: "weapons" })).data.weapons; }
  async armour(): Promise<Armour[]> { return (await this.catalogue<{ armour: Armour[] }>({ type: "armour" })).data.armour; }

  /** POST /calculate. Retries once after a 429 if the wait is short. */
  async calculate<T = Record<string, unknown>>(body: CalculateRequest): Promise<Ok<T>> {
    try {
      return (await this.request<T>("/calculate", { method: "POST", body: JSON.stringify(body) })).body!;
    } catch (e) {
      if (e instanceof ForgeApiError && e.code === "RATE_LIMITED" && (e.retryAfter ?? 99) <= 5) {
        await new Promise((r) => setTimeout(r, (e.retryAfter ?? 1) * 1000));
        return (await this.request<T>("/calculate", { method: "POST", body: JSON.stringify(body) })).body!;
      }
      throw e;
    }
  }
}

/** Up to 25 autocomplete choices for a name, from cached catalogue entries (Discord's limit is 25, 100 characters each). */
export function autocomplete<T extends { id: string; name: string }>(list: T[], typed: string, limit = 25): { name: string; value: string }[] {
  const q = typed.trim().toLowerCase();
  const starts = list.filter((x) => x.name.toLowerCase().startsWith(q));
  const contains = list.filter((x) => !x.name.toLowerCase().startsWith(q) && x.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit).map((x) => ({ name: x.name.slice(0, 100), value: x.id }));
}
