/**
 * API key checks, through the database (public.api_authorize): the key's SHA-256, the scope and a hash of the
 * caller's IP go in; allowed or not comes out, with the rate-limit numbers. The raw key never leaves this server.
 */
import { createHash } from "node:crypto";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/data/supabase";
import { ApiError, type ErrorCode } from "./errors";

export type Scope = "catalogue:read" | "calculator:execute";
export type Auth = { keyId: string | null; limit: number; remaining: number; reset: number; logId: number; logToken: string };
export type Finish = { logId: number; logToken: string; status: number; latencyMs: number; errorCode: string | null };

/** fc_live_ + 43 base64url characters (32 random bytes). */
export const KEY_FORMAT = /^fc_live_[A-Za-z0-9_-]{43}$/;
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** The caller's IP as Vercel reports it (its own header can't be set by the caller), hashed before it goes anywhere. */
export function ipHash(req: Request): string {
  const h = req.headers;
  const ip = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  return sha256(`forge-api-ip:${ip.trim()}`);
}

/** The key from "Authorization: Bearer <key>", or null when there's none. A malformed key is refused here, before any database call. */
export function readKey(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header == null || header.trim() === "") return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!m || !KEY_FORMAT.test(m[1])) throw new ApiError("INVALID_API_KEY");
  return m[1];
}

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(4000),
    });
  } catch {
    throw new ApiError("SERVICE_UNAVAILABLE");
  }
  if (!res.ok) throw new ApiError("SERVICE_UNAVAILABLE");
  return res.status === 204 ? null : res.json();
}

export type Authorizer = { authorize(req: Request, scope: Scope): Promise<Auth>; finish(f: Finish): Promise<void> };

type Decision = { ok: boolean; status?: number; code?: string; retry_after?: number; key_id?: string | null; limit?: number; remaining?: number; reset?: number; log_id?: number; log_token?: string };

export const dbAuthorizer: Authorizer = {
  async authorize(req, scope) {
    const key = readKey(req);
    const d = (await rpc("api_authorize", { p_key_hash: key ? sha256(key) : null, p_scope: scope, p_ip_hash: ipHash(req) })) as Decision | null;
    if (!d || typeof d.ok !== "boolean") throw new ApiError("SERVICE_UNAVAILABLE");
    if (!d.ok) {
      const code = (d.code ?? "INVALID_API_KEY") as ErrorCode;
      throw new ApiError(code === "BAD_REQUEST" ? "BAD_REQUEST" : code, undefined, undefined, d.retry_after);
    }
    return { keyId: d.key_id ?? null, limit: d.limit ?? 0, remaining: d.remaining ?? 0, reset: d.reset ?? 60, logId: d.log_id ?? 0, logToken: d.log_token ?? "" };
  },
  async finish(f) {
    try {
      await rpc("api_finish", { p_log_id: f.logId, p_token: f.logToken, p_status: f.status, p_latency_ms: f.latencyMs, p_error_code: f.errorCode });
    } catch { /* the log is best-effort; the database closes unfinished rows itself */ }
  },
};
