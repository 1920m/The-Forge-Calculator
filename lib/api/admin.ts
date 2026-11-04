/** Shapes and small helpers for the admin dashboard. The database checks the admin on every call; these only format. */

export type ApiKeyRow = {
  id: string; label: string; prefix: string; scopes: string[]; catalogue_rpm: number; calculator_rpm: number;
  created_at: string; expires_at: string | null; revoked_at: string | null; last_used_at: string | null; replaced_by: string | null;
};
export type ApiStats = {
  total_30d: number; last_24h: number; last_7d: number; failed_7d: number; rate_limited_7d: number; active_keys: number;
  latency_ms_7d: { avg: number | null; p95: number | null } | null;
  per_day: { day: string; requests: number; failed: number; rate_limited: number }[];
  per_key: { id: string; label: string; prefix: string; requests_7d: number; failed_7d: number }[];
  errors_7d: { code: string; count: number }[];
  recent: { at: string; endpoint: string; status: number | null; latency_ms: number | null; error_code: string | null; key_label: string | null; key_prefix: string | null }[];
};
export type KeyStatus = "active" | "expiring" | "expired" | "revoked";

export const SCOPES = [
  { id: "catalogue:read", name: "Catalogue", text: "GET /api/v1/catalogue" },
  { id: "calculator:execute", name: "Calculator", text: "POST /api/v1/calculate" },
] as const;

/** Revoked beats expired; a key with an expiry in the next 7 days (e.g. after a rotation) is "expiring". */
export function keyStatus(k: Pick<ApiKeyRow, "revoked_at" | "expires_at">, now = Date.now()): KeyStatus {
  if (k.revoked_at) return "revoked";
  if (k.expires_at) {
    const t = Date.parse(k.expires_at);
    if (t <= now) return "expired";
    if (t - now < 7 * 24 * 3600 * 1000) return "expiring";
  }
  return "active";
}

/** "fc_live_AbCd" → "fc_live_AbCd••••••••" (the rest of the key is never stored). */
export const maskKey = (prefix: string) => `${prefix}${"•".repeat(8)}`;

/** "3 minutes ago", "2 days ago", "never". */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  const units: [number, string][] = [[86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [n, name] of units) if (s >= n) { const v = Math.floor(s / n); return `${v} ${name}${v === 1 ? "" : "s"} ago`; }
  return "just now";
}

/** Friendly create-form check; the database checks the same rules again. */
export function checkNewKey(f: { label: string; scopes: string[]; catalogueRpm: number; calculatorRpm: number; expires: string }, now = Date.now()): string | null {
  const label = f.label.trim();
  if (!label || label.length > 60 || /[<>\u0000-\u001f]/.test(label)) return "Give the key a name of 1 to 60 characters, without < or >.";
  if (!f.scopes.length) return "Pick at least one permission.";
  for (const n of [f.catalogueRpm, f.calculatorRpm]) if (!Number.isInteger(n) || n < 1 || n > 10000) return "Limits must be whole numbers from 1 to 10,000 a minute.";
  if (f.expires && !(Date.parse(f.expires) > now)) return "The expiry date must be in the future.";
  return null;
}
