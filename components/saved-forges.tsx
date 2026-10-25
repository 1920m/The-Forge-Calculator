"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "@/lib/supabase/browser";
import { MAX_SAVED, SAVED_COLUMNS, cleanForgeName, readSavedForge, type NewForge, type SavedForge } from "@/lib/saved-forges";

type State = {
  forges: SavedForge[];
  /** True until the first load for this player finishes. */
  loading: boolean;
  error: string | null;
  /** Loads the player's saves the first time a page needs them; later pages reuse them. */
  ensure: () => void;
  save: (f: NewForge) => Promise<SavedForge | string>;
  remove: (id: string) => Promise<string | null>;
  rename: (id: string, name: string) => Promise<string | null>;
};

const Ctx = createContext<State | null>(null);

/** Saved forges for the signed-in player. Pages that use them call this; nothing loads until one does. */
export function useSavedForges(): State {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSavedForges needs SavedForgesProvider");
  const { ensure } = s;
  useEffect(() => { ensure(); }, [ensure]);
  return s;
}

const friendly = (msg: string | undefined) =>
  msg?.includes("up to 200") ? `You can save up to ${MAX_SAVED} forges. Delete some to save more.` : "Something went wrong. Please try again.";

export function SavedForgesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [forges, setForges] = useState<SavedForge[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  const load = useCallback(async (id: string) => {
    if (inFlight.current === id) return;
    inFlight.current = id;
    const { data, error: err } = await supabase().from("saved_forges").select(SAVED_COLUMNS).order("created_at", { ascending: false }).limit(MAX_SAVED);
    inFlight.current = null;
    if (err) { setError("Couldn't load your saved forges."); setLoadedFor(id); return; }
    setForges((data ?? []).flatMap((r) => { const f = readSavedForge(r); return f ? [f] : []; }));
    setError(null);
    setLoadedFor(id);
  }, []);

  const ensure = useCallback(() => {
    if (uid && loadedFor !== uid) void load(uid);
  }, [uid, loadedFor, load]);

  const save = useCallback(async (f: NewForge): Promise<SavedForge | string> => {
    const name = cleanForgeName(f.name) ?? "Forge";
    const { data, error: err } = await supabase().from("saved_forges").insert({ ...f, name }).select(SAVED_COLUMNS).single();
    const row = err ? null : readSavedForge(data);
    if (!row) return friendly(err?.message);
    setForges((cur) => [row, ...cur]);
    return row;
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase().from("saved_forges").delete().eq("id", id);
    if (err) return friendly(err.message);
    setForges((cur) => cur.filter((f) => f.id !== id));
    return null;
  }, []);

  const rename = useCallback(async (id: string, raw: string) => {
    const name = cleanForgeName(raw);
    if (!name) return "Give it a name.";
    const { error: err } = await supabase().from("saved_forges").update({ name }).eq("id", id);
    if (err) return friendly(err.message);
    setForges((cur) => cur.map((f) => (f.id === id ? { ...f, name } : f)));
    return null;
  }, []);

  const loading = !!uid && loadedFor !== uid;
  const value = useMemo(() => ({ forges: uid && loadedFor === uid ? forges : [], loading, error, ensure, save, remove, rename }), [uid, loadedFor, forges, loading, error, ensure, save, remove, rename]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
