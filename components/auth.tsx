"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/browser";
import { safeNext } from "@/lib/safe-next";

export type Provider = "google" | "discord";
export type Profile = { id: string; display_name: string; avatar_url: string | null };

type AuthState = {
  user: User | null;
  profile: Profile | null;
  /** True until the first session check finishes, so buttons don't flash "Sign in" for signed-in players. */
  loading: boolean;
  signIn: (provider: Provider, next?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null, profile: null, loading: true,
  signIn: async () => "Not ready", signOut: async () => {}, reloadProfile: async () => {},
});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) { setProfile(null); return; }
    const { data } = await supabase().from("profiles").select("id, display_name, avatar_url").eq("id", u.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    const sb = supabase();
    sb.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user ?? null);
      setLoading(false);
      void loadProfile(data.user ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      void loadProfile(u);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const signIn = useCallback(async (provider: Provider, next = "/") => {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
    const { error } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo } });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const reloadProfile = useCallback(() => loadProfile(user), [loadProfile, user]);

  const value = useMemo(() => ({ user, profile, loading, signIn, signOut, reloadProfile }), [user, profile, loading, signIn, signOut, reloadProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
