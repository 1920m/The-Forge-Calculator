"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/data/supabase";

let client: SupabaseClient | null = null;

/** One Supabase client for the browser. Sign-in uses the PKCE flow; the session lives in cookies. */
export function supabase(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: "pkce" } });
  return client;
}
