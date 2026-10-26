"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Catalogue } from "@/lib/engine/forge";
import { work } from "@/lib/forge-stats";
import { supabase } from "@/lib/supabase/browser";
import { SHARE_ID, readSharedProfile, type SharedProfile } from "@/lib/shared-profile";
import { Avatar } from "./account-menu";
import { LoadoutPanel, type Card } from "./loadout";
import { Reveal } from "./shell";

const noop = () => {};

/** Someone's shared profile: their name, picture and loadout, read-only. */
export function SharedProfilePage({ cat, id }: { cat: Catalogue; id: string }) {
  const valid = SHARE_ID.test(id);
  const [state, setState] = useState<{ status: "loading" } | { status: "missing" } | { status: "error" } | { status: "ok"; p: SharedProfile }>(valid ? { status: "loading" } : { status: "missing" });

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    void supabase().rpc("get_shared_profile", { sid: id }).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setState({ status: "error" }); return; }
      const p = readSharedProfile(data);
      setState(p ? { status: "ok", p } : { status: "missing" });
    });
    return () => { alive = false; };
  }, [id, valid]);

  const oreById = useMemo(() => new Map(cat.ores.map((o) => [o.id, o])), [cat]);
  const byId = useMemo(() => new Map<string, Card>(state.status === "ok" ? state.p.forges.map((f) => [f.id, { f, r: work(cat, oreById, f) }]) : []), [state, cat, oreById]);

  if (state.status === "loading") return <div className="page"><p className="muted">Loading profile…</p></div>;
  if (state.status !== "ok") {
    return (
      <div className="page">
        <section className="gp login">
          <div className="tb"><h1 className="title">{state.status === "error" ? "Couldn't load this profile" : "Profile not found"}</h1></div>
          <div className="pad">
            <p className="login-lead">{state.status === "error" ? "Something went wrong. Please try again in a moment." : "This link doesn't go to a shared profile. The player may have stopped sharing, which turns the old link off."}</p>
            <Link className="btn gb login-btn" href="/">Open the calculator</Link>
          </div>
        </section>
      </div>
    );
  }

  const { p } = state;
  return (
    <div className="page">
      <Reveal col={1}>
        <div className="forger-top">
          <div className="forger-who">
            <Avatar name={p.name} url={p.avatarUrl} size={44} />
            <h1 className="title">{p.name}</h1>
          </div>
          <Link className="btn sm" href="/forger">Make your own loadout</Link>
        </div>
      </Reveal>
      <Reveal col={2}>
        <LoadoutPanel name={p.name} loadout={p.loadout} byId={byId} drag={null} onOpen={noop} onClear={noop} readOnly />
      </Reveal>
    </div>
  );
}
