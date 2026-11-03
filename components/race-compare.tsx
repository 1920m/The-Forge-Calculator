"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Catalogue } from "@/lib/engine/forge";
import { combatDps, type CombatInput } from "@/lib/engine/loadout-dps";
import type { RuneSlot } from "@/lib/engine/runes";
import { work } from "@/lib/forge-stats";
import { ARMOUR_SLOTS, PROFILE_RACE } from "@/lib/loadout";
import { RACES, raceById } from "@/data/races";
import { fmt } from "@/lib/ui";
import { useAuth } from "./auth";
import { useSavedForges } from "./saved-forges";
import { useLoadout, type Card } from "./loadout";

type Props = {
  cat: Catalogue;
  weapon: CombatInput["weapon"];
  /** The enhancement level the calculator counts (the runes' level, or +0 without runes). */
  level: number;
  runes?: readonly (RuneSlot | null)[];
  choice: string | null;
  onChoice: (v: string | null) => void;
};

/**
 * The calculator's race choice and what it does to this weapon: weapon only, with the race, and with your Profile's
 * armour as well. Only reads the Profile; choosing a race here never changes it.
 */
export function RaceCompare({ cat, weapon, level, runes, choice, onChoice }: Props) {
  const { user } = useAuth();
  const { forges, loading } = useSavedForges();
  const oreById = useMemo(() => new Map(cat.ores.map((o) => [o.id, o])), [cat]);
  // Only your armour is needed: this weapon takes the place of the one in your loadout (and its runes).
  const armourById = useMemo(() => new Map<string, Card>(user ? forges.filter((f) => f.kind === "armour").map((f) => [f.id, { f, r: work(cat, oreById, f) }]) : []), [user, forges, cat, oreById]);
  const { loadout, ready } = useLoadout(armourById, !loading);
  const profileRace = ready ? loadout.race : null;
  const raceId = choice === PROFILE_RACE ? (user ? profileRace : null) : choice;
  const race = raceId ? raceById.get(raceId) ?? null : null;
  const armour = useMemo(() => ARMOUR_SLOTS.map((s) => {
    const c = loadout[s] ? armourById.get(loadout[s]!) : undefined;
    return c && !c.r.missingOres ? { ores: c.r.mix.map((m) => ({ id: m.ore.id, count: m.count })) } : null;
  }), [loadout, armourById]);
  const hasArmour = user != null && ready && armour.some(Boolean);

  const rows = useMemo(() => {
    const base = { weapon, level, runes };
    const plain = combatDps(base);
    const withRace = race ? combatDps({ ...base, raceId: race.id }) : null;
    const full = hasArmour ? combatDps({ ...base, armour, raceId: race?.id ?? null }) : null;
    return { plain, withRace, full };
  }, [weapon, level, runes, race, armour, hasArmour]);
  const last = rows.full ?? rows.withRace ?? rows.plain;
  const value = choice === PROFILE_RACE && !user ? "" : choice ?? "";

  return (
    <div className="kv calc-race">
      <span>Race:</span>
      <span>
        <select className="input sm" aria-label="Race for the DPS" value={value} onChange={(e) => onChoice(e.target.value || null)}>
          <option value="">None</option>
          {user && <option value={PROFILE_RACE}>Use my Profile race ({profileRace ? raceById.get(profileRace)?.name : ready ? "none set" : "loading"})</option>}
          {RACES.map((r) => <option key={r.id} value={r.id}>{r.name}{r.combat ? "" : " (no damage effect)"}</option>)}
        </select>
        <span className="race-compare small">
          <span>Weapon only{level ? ` (+${level}${runes ? " with runes" : ""})` : ""}: <b>{fmt(rows.plain.total)}</b></span>
          {rows.withRace && <span>With {race!.name}: <b>{fmt(rows.withRace.total)}</b></span>}
          {rows.full && <span style={{ color: "var(--gold)" }}>Full Loadout (your Profile armour{race ? ` + ${race.name}` : ""}): <b>{fmt(rows.full.total)}</b></span>}
          {last.lowHp != null && <span className="faint">Below 35% HP: {fmt(last.lowHp)}</span>}
          {race?.combat?.conditions?.length ? <span className="faint">{race.name} has situational bonuses that aren&apos;t in these numbers.</span> : null}
          {race && !race.combat && <span className="faint">{race.name}&apos;s traits don&apos;t change weapon damage.</span>}
          {!user && <span className="faint"><Link className="inline-link" href="/login?next=%2F">Sign in</Link> to add the armour from your Profile.</span>}
          {user && ready && !hasArmour && <span className="faint">Equip armour in your <Link className="inline-link" href="/forger">Loadout</Link> to see the Full Loadout DPS.</span>}
        </span>
      </span>
    </div>
  );
}
