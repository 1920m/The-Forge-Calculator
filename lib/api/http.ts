/**
 * The shared request flow for both endpoints: request ID, API key and rate limit, the endpoint's work, a consistent
 * JSON envelope, rate-limit headers, and the usage log (written after the response is sent).
 */
import { randomBytes } from "node:crypto";
import { ApiError, ERRORS } from "./errors";
import { API_VERSION } from "./version";
import type { Auth, Authorizer, Scope } from "./auth";

export const MAX_BODY_BYTES = 16 * 1024;

export type Ctx = { req: Request; auth: Auth; requestId: string };
export type Out = { status?: number; body?: unknown; headers?: Record<string, string> };
export type Deps = { authorizer: Authorizer; schedule: (task: () => Promise<void>) => void; now: () => number };

export const newRequestId = () => `req_${randomBytes(9).toString("base64url")}`;

const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: body === undefined ? headers : { "Content-Type": "application/json; charset=utf-8", ...headers } });

export function errorBody(e: ApiError, requestId: string) {
  return { success: false, apiVersion: API_VERSION, error: { code: e.code, message: e.message, requestId, ...(e.details !== undefined ? { details: e.details } : {}) } };
}

/** Runs one API request from start to finish. Never throws: every failure becomes a JSON error. */
export async function handle(req: Request, scope: Scope, deps: Deps, work: (ctx: Ctx) => Promise<Out>): Promise<Response> {
  const requestId = newRequestId();
  const started = deps.now();
  const base: Record<string, string> = { "X-Request-Id": requestId, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  let auth: Auth | null = null;
  let status = 500, errorCode: string | null = null, res: Response;
  try {
    auth = await deps.authorizer.authorize(req, scope);
    const rate = { "X-RateLimit-Limit": String(auth.limit), "X-RateLimit-Remaining": String(auth.remaining), "X-RateLimit-Reset": String(auth.reset) };
    const out = await work({ req, auth, requestId });
    status = out.status ?? 200;
    res = json(status, out.body, { ...base, ...rate, ...out.headers });
  } catch (err) {
    const e = err instanceof ApiError ? err : new ApiError("INTERNAL_ERROR");
    if (!(err instanceof ApiError)) console.error(`[api] ${requestId}`, err instanceof Error ? err.message : "unknown error");
    status = e.status; errorCode = e.code;
    res = json(status, errorBody(e, requestId), { ...base, ...(e.retryAfter ? { "Retry-After": String(e.retryAfter) } : {}) });
  }
  if (auth && auth.logId) {
    const a = auth;
    deps.schedule(() => deps.authorizer.finish({ logId: a.logId, logToken: a.logToken, status, latencyMs: Math.round(deps.now() - started), errorCode }));
  }
  return res;
}

/** The JSON body, read with a size limit. */
export async function readJson(req: Request): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) throw new ApiError("UNSUPPORTED_MEDIA_TYPE");
  const declared = Number(req.headers.get("content-length"));
  if (declared > MAX_BODY_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE", `The body can be at most ${MAX_BODY_BYTES / 1024} KB.`);
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError("INVALID_JSON");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new ApiError("PAYLOAD_TOO_LARGE", `The body can be at most ${MAX_BODY_BYTES / 1024} KB.`); }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError("INVALID_JSON");
  }
}

export { ERRORS };
