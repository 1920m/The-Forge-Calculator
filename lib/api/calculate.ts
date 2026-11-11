/**
 * POST /api/v1/calculate, without the HTTP: validated input in, plain data out. Every number comes from the same
 * engine functions the website uses (forge-eval, loadout-dps, golemite); nothing here has its own formula.
 */
import { qualityLabel, roundStat, scaleTraitText, type Catalogue, type Mix } from "@/lib/engine/forge";
import { MAX_ENHANCE, enhanceFactor, type Kind, type World } from "@/lib/engine";
import { evaluateForge } from "@/lib/engine/forge-eval";
import { combatDps, type CombatConditions, type CombatResult } from "@/lib/engine/loadout-dps";
import { encodeRunes, slotsAt, type RuneSlot } from "@/lib/engine/runes";
import { moldScreenChance } from "@/lib/engine/molds";
import { golemGrowth, golemite } from "@/lib/engine/golemite";
import { calculatorHref } from "@/lib/saved-forges";
import { golemiteHref } from "@/lib/golemites";
import { imageUrl } from "@/lib/data/supabase";
import { SITE_URL } from "@/lib/site";
import { raceById } from "@/data/races";
import { runeById, secondaryById, type SecondaryId } from "@/data/runes";
import { GOLEMITE } from "@/data/golemites";
import { ApiError } from "./errors";
import { armourWorlds, forgeWorld, oreWorlds, weaponWorlds } from "./catalogue";
import type { CalculateInput, DpsInputBody, ForgeInput, GolemiteInput, LoadoutInput } from "./schema";

export type Warning = { code: string; message: string };
type OreIn = { id: string; count: number };

const MIN_FORGE_ORES = 3;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const WORLD_LABEL: Record<number, string> = { 2: "1–2", 3: "3", 4: "4" };

const DPS_NOTE: Warning = { code: "ESTIMATED_DPS", message: "DPS is an estimate from the community damage model (crits, procs and damage over time averaged), not a measurement from the game." };
const PROC_NOTE: Warning = { code: "PROC_ENHANCEMENT_UNVERIFIED", message: "Whether burn, explosions and other procs grow with enhancement isn't confirmed; here they do." };

function mixOf(cat: Catalogue, ores: OreIn[]): Mix {
  const byId = new Map(cat.ores.map((o) => [o.id, o]));
  const bad = ores.filter((o) => !byId.has(o.id)).map((o) => o.id);
  if (bad.length) throw new ApiError("INVALID_ORE", `Unknown ore ID${bad.length > 1 ? "s" : ""}: ${bad.join(", ")}.`, { ores: bad });
  return ores.map((o) => ({ ore: byId.get(o.id)!, count: o.count }));
}

const total = (ores: OreIn[]) => ores.reduce((n, o) => n + o.count, 0);

function needOres(ores: OreIn[]) {
  if (total(ores) < MIN_FORGE_ORES) throw new ApiError("NOT_ENOUGH_ORES", `A forge needs at least ${MIN_FORGE_ORES} ores.`);
}

function runeSlots(runes: ({ id: string; level: 1 | 2 | 3; secondaries: string[] } | null)[] | undefined, kind: Kind): (RuneSlot | null)[] {
  if (!runes) return [];
  return runes.map((r, i) => {
    if (!r) return null;
    const rune = runeById.get(r.id);
    if (!rune || rune.kind !== kind) throw new ApiError("INVALID_RUNE", `Slot ${i + 1}: "${r.id}" isn't a ${kind} rune.`);
    const secs = [...new Set(r.secondaries)];
    if (secs.length !== r.secondaries.length) throw new ApiError("INVALID_RUNE", `Slot ${i + 1}: each side effect can only appear once.`);
    if (secs.length > r.level) throw new ApiError("INVALID_RUNE", `Slot ${i + 1}: a level ${r.level} rune has at most ${r.level} side effect${r.level === 1 ? "" : "s"}.`);
    for (const s of secs) if (secondaryById.get(s as SecondaryId)?.kind !== kind) throw new ApiError("INVALID_RUNE", `Slot ${i + 1}: "${s}" isn't a ${kind} rune side effect.`);
    return { id: r.id, level: r.level, secondaries: secs as SecondaryId[] };
  });
}

function race(id: string | undefined) {
  if (!id) return null;
  if (!raceById.has(id)) throw new ApiError("INVALID_RACE", `Unknown race ID: ${id}.`);
  return id;
}

/** Which forge (2 = Worlds 1–2, 3, 4): the one asked for, else the only one with the item, else the only one with all the ores. */
function resolveWorld(cat: Catalogue, kind: Kind, item: string | undefined, ores: Mix, asked: number | undefined, warnings: Warning[]): { world: World; inferred: boolean } {
  const itemWorlds = item ? (kind === "weapon" ? weaponWorlds(cat, item) : armourWorlds(cat, item)).map((x) => x.world) : [2, 3, 4];
  if (asked != null) {
    const w = forgeWorld(asked);
    if (item && !itemWorlds.includes(w)) throw new ApiError("ITEM_NOT_IN_WORLD", `That item isn't in World ${WORLD_LABEL[w]}'s forge. It's in World ${itemWorlds.map((x) => WORLD_LABEL[x]).join(", ")}.`, { worlds: itemWorlds });
    return { world: asked as World, inferred: false };
  }
  if (itemWorlds.length === 1) return { world: itemWorlds[0] as World, inferred: true };
  const withOres = itemWorlds.filter((w) => ores.every((m) => oreWorlds(m.ore).includes(w)));
  if (withOres.length === 1) {
    warnings.push({ code: "WORLD_FROM_ORES", message: `World ${WORLD_LABEL[withOres[0]]} was chosen because it's the only one where this item can be forged and all these ores are found.` });
    return { world: withOres[0] as World, inferred: true };
  }
  throw new ApiError("WORLD_REQUIRED", undefined, { worlds: itemWorlds, labels: itemWorlds.map((w) => WORLD_LABEL[w]) });
}

function itemKind(cat: Catalogue, id: string): { kind: Kind; slot: string | null } | null {
  if (cat.weapons.some((w) => w.id === id)) return { kind: "weapon", slot: null };
  const a = cat.armour.find((x) => x.id === id);
  return a ? { kind: "armour", slot: a.slot } : null;
}

function traitsOf(traits: ReturnType<typeof evaluateForge>["result"]["traits"], kind: Kind) {
  const list = traits.map((t) => ({
    ore: { id: t.ore.id, name: t.ore.name }, share: r4(t.share), strength: r4(t.strength),
    effects: t.ore.traits.filter((x) => x.kinds.includes(kind)).map((x) => ({ text: scaleTraitText(x.text, t.strength), fullText: x.text, appliesTo: [...x.kinds].sort() })),
  }));
  return { active: list.filter((t) => t.strength > 0), inactive: list.filter((t) => t.strength === 0) };
}

function dpsOut(c: CombatResult) {
  const r = c.result;
  return {
    estimated: true, total: r2(c.total), hit: r2(r.hit), procs: r2(r.procs),
    parts: r.parts.map((p) => ({ label: p.label, dps: r2(p.dps) })),
    hitsPerSecond: r4(r.attacksPerSecond), critChance: r4(r.critChance), critDamageBonus: r4(r.critDamage), critHitMultiplier: r4(1.45 + r.critDamage),
    lethality: r4(r.lethality), attackSpeedBonus: r4(r.atkSpeed),
    breakdown: c.breakdown.map((b) => ({ layer: b.key, label: b.label, dps: r2(b.dps) })),
    // Situational figures, never part of `total`.
    scenarios: {
      below35PercentHp: c.lowHp == null ? null : r2(c.lowHp),
      withConditions: c.conditional == null ? null : r2(c.conditional),
      atNightMoonStone: r.night == null ? null : r2(r.night),
    },
    countedEffects: c.counted,
  };
}

/* ------------------------------------------------------------------ forge */

export function calculateForge(cat: Catalogue, input: ForgeInput) {
  const warnings: Warning[] = [];
  const mix = mixOf(cat, input.ores);
  needOres(input.ores);
  if (input.item) {
    const k = itemKind(cat, input.item);
    if (!k) throw new ApiError("INVALID_ITEM", `Unknown item ID: ${input.item}.`);
    if (k.kind !== input.kind) throw new ApiError("ITEM_KIND_MISMATCH", `${input.item} is ${k.kind === "weapon" ? "a weapon" : "armour"}, not ${input.kind === "weapon" ? "a weapon" : "armour"}.`);
  }
  if (input.molds != null && !input.item) throw new ApiError("VALIDATION_ERROR", "Molds are aimed at an item: send `item` too.");
  if (input.runes?.some(Boolean) && input.kind !== "weapon") throw new ApiError("INVALID_RUNE", "Runes are only calculated for weapons in v1.");
  const runes = runeSlots(input.runes, input.kind);
  const { world, inferred } = resolveWorld(cat, input.kind, input.item, mix, input.world, warnings);

  const q = input.quality / 100;
  const first = evaluateForge(cat, { mix, kind: input.kind, world, quality: q, pick: input.item ? { id: input.item } : null });
  const itemClass = input.item ? first.result.classes.find((c) => c.variants.some((v) => v.id === input.item))?.name ?? null : null;
  if (input.item && !itemClass) throw new ApiError("ITEM_NOT_IN_WORLD");
  const ev = input.lockClass || input.molds != null
    ? evaluateForge(cat, { mix, kind: input.kind, world, quality: q, lock: input.lockClass ? itemClass : null, molds: input.molds != null ? { count: input.molds, itemId: input.item! } : null, pick: input.item ? { id: input.item } : null })
    : first;
  const { result, normal, selected, mold, lock } = ev;
  if (!selected) throw new ApiError("NOT_ENOUGH_ORES", "Nothing can be forged with these ores.");
  const { cls, v } = selected;

  if (cls.probability === 0) warnings.push({ code: "CLASS_NOT_AVAILABLE", message: `${cls.name} can't come out with ${result.total} ores (its odds start higher), so this item's chance is 0%.` });
  if (input.lockClass && lock !== cls.name) warnings.push({ code: "LOCK_NOT_AVAILABLE", message: `${cls.name} can be locked from ${cls.lockAt} ores; the lock wasn't applied.` });
  if (result.capped) warnings.push({ code: "ODDS_CAPPED", message: "Odds are only known up to 55 ores, so the 55-ore odds are used." });
  if (v.tag === "abyss") warnings.push({ code: "ABYSS_FORGE_ONLY", message: `${v.name} is forged only at the Abyss Forge, whose odds aren't published, so its chance is 0% here; its stats are real.` });
  if (cls.incomplete) warnings.push({ code: "SHOP_ITEMS_MISSING", message: `${cls.name} also has shop-blueprint weapons not in the data, so chances inside it may be a little high.` });
  if (input.molds != null && !mold.chancesKnown) warnings.push({ code: "MOLD_EFFECT_UNKNOWN", message: "These molds change the real chances by an amount nobody has measured; the chances shown are without them." });

  const normalV = normal.classes.find((c) => c.name === cls.name)?.variants.find((x) => x.id === v.id);
  const level = Math.min(MAX_ENHANCE, input.enhancement);
  const isWeapon = input.kind === "weapon";
  const a = isWeapon ? null : cat.armour.find((x) => x.id === v.id);
  let dps: ReturnType<typeof dpsOut> | null = null, dpsBase: number | null = null;
  if (isWeapon && v.raw != null && v.interval) {
    const c = combatDps({ weapon: { ores: input.ores, raw: v.raw, interval: v.interval, cls: cls.name }, level, runes: runes.length ? runes : undefined });
    dps = dpsOut(c);
    dpsBase = v.dps ? r2(v.dps.total) : null;
    warnings.push(DPS_NOTE);
    if (level > 0) warnings.push(PROC_NOTE);
  }

  const runesOn = runes.some(Boolean);
  const link = SITE_URL + calculatorHref({ kind: input.kind, world, class_name: cls.name, variant_id: v.id, quality: input.quality, ores: input.ores,
    ...(runesOn ? { enhance: level, runes: encodeRunes([...runes, null, null, null].slice(0, 3)) } : {}) });

  return {
    data: {
      type: "forge" as const,
      world, worldLabel: WORLD_LABEL[forgeWorld(world)], worldInferred: inferred,
      kind: input.kind,
      quality: { percent: input.quality, label: qualityLabel(cat, input.quality) },
      ores: mix.map((m) => ({ id: m.ore.id, name: m.ore.name, count: m.count, share: r4(m.count / result.total), rarity: m.ore.rarity, image: imageUrl("ores", m.ore.id) })),
      totalOres: result.total,
      multiplier: result.multiplier == null ? null : r4(result.multiplier),
      rarity: result.rarity,
      primaryOre: result.primary ? { id: result.primary.id, name: result.primary.name } : null,
      item: {
        id: v.id, name: v.name, class: cls.name, slot: a?.slot ?? null, image: imageUrl(isWeapon ? "weapons" : "armour", v.id),
        stat: { name: isWeapon ? "damage" : "defence", unit: isWeapon ? "DMG" : "DEF", value: v.value, atFullQuality: v.raw == null ? null : roundStat((v.raw * 2) / (1 + q), input.kind) },
        weapon: isWeapon ? { attackInterval: v.interval ?? null, cardSpeed: v.speed ?? null, range: v.range ?? null, dpsAtPlus0: dpsBase, dps } : null,
        chance: { overall: r4(v.overall), inClass: r4(v.chance), classChance: r4(cls.probability), withoutLockOrMolds: normalV ? r4(normalV.overall) : null },
        lock: { lockable: cls.lockable, lockAt: cls.lockAt, locked: lock === cls.name },
        molds: input.molds != null ? {
          count: mold.molds, needed: mold.need.value, neededStatus: mold.need.kind, state: mold.state, guaranteed: mold.state === "guaranteed",
          moldScreenChance: mold.state === "partial" ? moldScreenChance(mold.molds, mold.need) : null, chancesKnown: mold.chancesKnown,
        } : null,
        enhancement: { level, multiplier: enhanceFactor(level), value: v.raw == null ? null : roundStat(v.raw * enhanceFactor(level), input.kind), runeSlotsOpen: slotsAt(level) },
      },
      traits: traitsOf(result.traits, input.kind),
      classes: input.detail === "full" ? result.classes.map((c) => ({
        name: c.name, chance: r4(c.probability), lockAt: c.lockAt, lockable: c.lockable,
        items: c.variants.map((x) => ({ id: x.id, name: x.name, weight: x.weight, inClass: r4(x.chance), overall: r4(x.overall), value: x.value })),
      })) : undefined,
      links: { calculator: link },
    },
    warnings,
  };
}

/* ------------------------------------------------------------------ pieces for dps and loadout */

/** A worn piece rebuilt from its recipe: the same forge as the calculator, in a world where the item exists. */
function piece(cat: Catalogue, p: { item: string; ores: OreIn[]; quality: number }, kind: Kind, slot: string | null) {
  const k = itemKind(cat, p.item);
  if (!k) throw new ApiError("INVALID_ITEM", `Unknown item ID: ${p.item}.`);
  if (k.kind !== kind || (slot && k.slot !== slot)) throw new ApiError("ITEM_KIND_MISMATCH", `${p.item} doesn't go in the ${slot ?? kind} slot.`);
  const mix = mixOf(cat, p.ores);
  needOres(p.ores);
  const worlds = (kind === "weapon" ? weaponWorlds(cat, p.item) : armourWorlds(cat, p.item)).map((x) => x.world);
  // Stats don't depend on the world (base × multiplier × quality); any world with the item gives the same numbers.
  const ev = evaluateForge(cat, { mix, kind, world: worlds[0] as World, quality: p.quality / 100, pick: { id: p.item } });
  const v = ev.selected?.v;
  if (!v || v.id !== p.item || v.raw == null) throw new ApiError("INVALID_ITEM", `Couldn't work out ${p.item}.`);
  return { mix, cls: ev.selected!.cls.name, v, rarity: ev.result.rarity, multiplier: ev.result.multiplier };
}

const conditionsOf = (c: CombatConditions | undefined) => (c && Object.values(c).some((x) => x !== undefined && x !== false && x !== 0) ? c : undefined);

export function calculateDps(cat: Catalogue, input: DpsInputBody) {
  const w = piece(cat, input.weapon, "weapon", null);
  const runes = runeSlots(input.runes, "weapon");
  const armour = (input.armour ?? []).map((a) => { mixOf(cat, a.ores); return { ores: a.ores }; });
  const raceId = race(input.race);
  const c = combatDps({
    weapon: { ores: input.weapon.ores, raw: w.v.raw!, interval: w.v.interval!, cls: w.cls }, level: input.enhancement,
    runes: runes.length ? runes : undefined, armour, raceId, conditions: conditionsOf(input.conditions),
  });
  const warnings: Warning[] = [DPS_NOTE];
  if (input.enhancement > 0) warnings.push(PROC_NOTE);
  if (raceId && raceById.get(raceId)?.combat?.conditions?.length && !input.conditions) warnings.push({ code: "SITUATIONAL_BONUSES_OFF", message: "This race has situational bonuses; send `conditions` to see them separately." });
  return {
    data: {
      type: "dps" as const,
      weapon: { id: w.v.id, name: w.v.name, class: w.cls, damage: w.v.value, attackInterval: w.v.interval, rarity: w.rarity, multiplier: w.multiplier == null ? null : r4(w.multiplier), image: imageUrl("weapons", w.v.id) },
      enhancement: input.enhancement, race: raceId,
      dps: dpsOut(c),
    },
    warnings,
  };
}

export function calculateLoadout(cat: Catalogue, input: LoadoutInput) {
  const slots = ["helmet", "chestplate", "leggings"] as const;
  const armour = slots.map((s) => (input[s] ? { slot: s, ...piece(cat, input[s]!, "armour", s) } : null));
  const w = input.weapon ? piece(cat, input.weapon, "weapon", null) : null;
  const runes = runeSlots(input.runes, "weapon");
  const raceId = race(input.race);
  if (!w && !armour.some(Boolean)) throw new ApiError("VALIDATION_ERROR", "Send at least a weapon or one armour piece.");
  const c = w ? combatDps({
    weapon: { ores: input.weapon!.ores, raw: w.v.raw!, interval: w.v.interval!, cls: w.cls }, level: input.enhancement,
    runes: runes.length ? runes : undefined, armour: armour.map((a) => (a ? { ores: input[a.slot]!.ores } : null)), raceId, conditions: conditionsOf(input.conditions),
  }) : null;
  const pieces = armour.filter((a): a is NonNullable<typeof a> => !!a);
  const warnings: Warning[] = [];
  if (c) { warnings.push(DPS_NOTE); if (input.enhancement > 0) warnings.push(PROC_NOTE); }
  warnings.push({ code: "DEFENCE_ONLY", message: "Armour shows defence at +0 and the damage traits counted in DPS; health, shields and other effects aren't added up." });
  return {
    data: {
      type: "loadout" as const,
      weapon: w ? { id: w.v.id, name: w.v.name, class: w.cls, damage: w.v.value, attackInterval: w.v.interval, rarity: w.rarity, image: imageUrl("weapons", w.v.id) } : null,
      armour: pieces.map((a) => ({ slot: a.slot, id: a.v.id, name: a.v.name, class: a.cls, defence: a.v.value, rarity: a.rarity, image: imageUrl("armour", a.v.id) })),
      defence: pieces.reduce((n, a) => n + (a.v.value ?? 0), 0),
      enhancement: input.enhancement, race: raceId,
      dps: c ? dpsOut(c) : null,
    },
    warnings,
  };
}

/* ------------------------------------------------------------------ golemite */

export function calculateGolemite(cat: Catalogue, input: GolemiteInput) {
  const mix = mixOf(cat, input.ores);
  const g = golemite(mix);
  const grow = golemGrowth(input.level);
  return {
    data: {
      type: "golemite" as const,
      name: g.name, class: "Golem", rarity: g.rarity,
      quality: { percent: input.quality, label: qualityLabel(cat, input.quality) },
      ores: mix.map((m) => ({ id: m.ore.id, name: m.ore.name, count: m.count, share: r4(m.count / g.total), rarity: m.ore.rarity, image: imageUrl("ores", m.ore.id) })),
      totalOres: g.total, primaryOre: g.primary ? { id: g.primary.id, name: g.primary.name, image: imageUrl("ores", g.primary.id) } : null,
      miningHelp: g.mining, oreTraitShare: g.traitScale,
      traits: g.traits.map((t) => ({
        ore: { id: t.ore.id, name: t.ore.name }, share: r4(t.share), shareStrength: r4(t.strength), strength: r4(t.golem),
        effects: t.lines, appliesTo: [...new Set(t.effects.flatMap((e) => e.appliesTo))].sort(),
        byType: t.effects.map((e) => ({ text: e.text, appliesTo: e.appliesTo })),
      })),
      growth: { level: grow.level, maxLevel: GOLEMITE.maxLevel, size: r4(grow.size), canFight: grow.fights, combatLevel: GOLEMITE.combatLevel, snacksToCombat: grow.toCombat, snacksToMax: grow.toMax },
      storage: GOLEMITE.storage,
      combat: { status: "unknown", damage: null, note: "How Golemites fight isn't known, so there's no damage figure." },
      links: { calculator: SITE_URL + golemiteHref({ ores: input.ores, quality: input.quality }) },
    },
    warnings: [{ code: "GOLEMITE_TRAITS_UNVERIFIED", message: "The player gets all of a Golemite's ore traits, weapon and armour; whether quality changes them isn't confirmed in game." }],
  };
}

export function calculate(cat: Catalogue, input: CalculateInput) {
  switch (input.type) {
    case "forge": return calculateForge(cat, input);
    case "dps": return calculateDps(cat, input);
    case "loadout": return calculateLoadout(cat, input);
    case "golemite": return calculateGolemite(cat, input);
  }
}
