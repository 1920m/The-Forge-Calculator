/**
 * Where to go after signing in. Only paths on this site are allowed, so a sign-in link can never send a
 * player to another website (no "https://…", "//evil.com", "/\evil.com" or control characters).
 */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || raw.length > 300) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  try {
    const u = new URL(raw, "https://forge.invalid");
    if (u.origin !== "https://forge.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/** Display names: 1 to 32 characters, no angle brackets or control characters (the database checks the same). */
export function cleanDisplayName(raw: string): string | null {
  const name = raw.replace(/[<>\u0000-\u001f\u007f]/g, "").trim().slice(0, 32).trim();
  return name.length ? name : null;
}
