/** Public configuration only; this module must never accept administrative keys. */
export function publicDataConfig(env: { url?: string; key?: string }) {
  if (!env.url || !env.key) return null;
  let url: URL;
  try {
    url = new URL(env.url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use your Supabase project's HTTPS origin.");
  }
  if (env.key.startsWith("sb_secret_")) {
    throw new Error("A secret key cannot be used in public configuration.");
  }
  if (env.key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(atob(env.key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role !== "anon") throw new Error("not anon");
    } catch {
      throw new Error("The public legacy key must have the anon role.");
    }
  } else if (!env.key.startsWith("sb_publishable_")) {
    throw new Error("Use a Supabase publishable key or legacy anon key.");
  }
  return { url: url.origin, key: env.key, imageHost: url.hostname };
}
