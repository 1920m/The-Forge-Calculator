import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/shell";
import { SHOW_STATUS_LABELS } from "@/lib/ui";

export const metadata: Metadata = { title: "How it works", description: "The formulas behind The Forge: multiplier, class and variant odds, traits, defence, damage, quality, enhancement, DPS, how many tries and race spins." };

const F = ({ children }: { children: React.ReactNode }) => <div className="formula">{children}</div>;

const cards: { id?: string; title: string; body: React.ReactNode; badge: "ok" | "der" | "unv" }[] = [
  { title: "Average multiplier", badge: "ok", body: <>The forge has four slots, so a craft uses up to four different ore types, with any amount of each. Every ore has a multiplier. The craft uses the average, weighted by how many of each you add.<F>M = sum(multiplier × count) ÷ total ores</F><span className="muted">Sun Stone 9, Lucky Cat 8, Sealed Curse 8, Roosite 5 gives M = 12.51, exactly what the forge screen shows.</span></> },
  { id: "odds", title: "Class odds", badge: "ok", body: <>Only the total number of ores decides which classes can come out, from 3 to 55 ores. The odds table is the same in every world, but the classes in slots 3 to 5 change: World 1–2 has Gauntlets, Katana and Greatsword, World 3 has Mace, Axe and Spear, and World 4 has Mace, Katana and Spear. Each world also has its own variants. Above 55 ores the 55-ore odds are used.</> },
  { title: "Variant odds", badge: "ok", body: <>Inside a class each variant shows a weight of 1/N. Rarer variants have a bigger N.<F>P(variant) = (1 ÷ N) ÷ sum of (1 ÷ N) in the class</F><span className="muted">Overall chance = class chance × chance inside the class.</span></> },
  { title: "Primary ore and rarity", badge: "ok", body: <>The ore you add the most of is the primary ore. If counts tie, the higher multiplier wins. It sets the item&apos;s look and its rarity.</> },
  { title: "Traits", badge: "ok", body: <>A trait only transfers when its ore makes up at least 10% of the craft. Its strength then rises in a straight line to full strength at 30%. Everything in the trait scales with it: chances, damage, stat bonuses and penalties. Sun Stone at a 20% share burns with a 19.3% chance for 19.3% damage per second instead of 35% and 35%.<F>strength = 0.10 + 4.5 × (share − 0.10), capped at 100%</F><TraitChart /></> },
  { title: "Defence and damage", badge: "ok", body: <>Armour and weapons use the same multiplier, then your craft quality.<F>Defence = health % × M × (1 + quality), rounded to a whole number</F><F>Damage = base damage × M × (1 + quality), rounded to two decimals</F><span className="muted">Quality adds on top of the base: a 100% craft is worth 2×, a 50% craft 1.5×, and even a 0% craft keeps 1×. For example a 92% craft has 96% of the 100% value.</span></> },
  { id: "enhancement", title: "Enhancement", badge: "ok", body: <>Each enhancement level adds 5% of the stat, from +0 to +10. The calculator shows the stat at every level, not the chance to succeed.<F>stat at level L = value × (1 + 0.05 × L)</F></> },
  { id: "dps", title: "DPS", badge: "der", body: <>Weapons also show damage per second, with the traits your ores transfer. Each hit is boosted by lethality and crits, and attack speed shortens the real swing time. The calculator shows that real time as ATK Speed; the number on the game&apos;s item card is an index value that is often much faster than the weapon really swings (a Mace&apos;s card says 0.46s but it swings every 1.17s).<F>DPS = damage × (1 + lethality) × crit blend × hits per second + procs</F><F>crit blend = crit chance × (1.45 + crit damage) + (1 − crit chance)</F><F>hits per second = (1 + attack speed) ÷ swing time</F><span className="muted">Procs add their share of weapon damage: explosions, smite, black holes and lightning on hit, and burn and poison while they are up. This follows the community DPS calculator on the Forge wiki and leaves out race, runes and achievements.</span></> },
  { id: "tries", title: "How many tries?", badge: "der", body: <>Each forge is counted as a fresh roll, so a 2% item is 2% on your 1st try and on your 100th. With a chance p per try:<F>average tries = 1 ÷ p</F><F>chance of getting it within n tries = 1 − (1 − p)<sup>n</sup></F><F>tries for a chance c = ln(1 − c) ÷ ln(1 − p), rounded up</F><span className="muted">For a 2% item: 1 ÷ 0.02 = <b className="gold">50 forges</b> on average. That doesn&apos;t mean 50 forges is enough: after 50, only 1 − 0.98<sup>50</sup> = 64% of players have it. Half get it within ln(0.5) ÷ ln(0.98) = 34.3, so <b className="gold">35 forges</b>; 9 in 10 within ln(0.1) ÷ ln(0.98) = 114.0, so <b className="gold">114 forges</b>. Each forge uses the whole mix again, so ores needed = tries × ores in the mix. The calculator uses the overall chance (class chance × chance inside the class). This assumes there&apos;s no pity or guarantee, which no source mentions.</span></> },
  { id: "dps-target", title: "Hit a DPS target", badge: "der", body: <>Set the DPS you want and the calculator checks every weapon your mix can give. Each forge gives exactly one weapon, so the chance of getting one that reaches the target is the sum of their overall chances. Then the tries maths above applies.<F>p = sum of overall chances of the weapons at or above the target</F><F>DPS at +L = DPS at +0 × (1 + 0.05 × L)</F><span className="muted">If a mix gives Mace A (2,000 DPS, 30%), Mace B (3,000 DPS, 10%) and two daggers below 1,500 DPS, a 1,500 DPS target has p = 30% + 10% = 40%: <b className="gold">2.5 forges</b> on average and 9 in 10 players within <b className="gold">5</b>. Enhancement scales every weapon by the same amount, since every part of DPS scales with weapon damage. Race and runes aren&apos;t included.</span></> },
  { id: "races", title: "Race spins", badge: "der", body: <>Each spin gives exactly one race, with the chances from the <a className="inline-link" href="https://forgewiki.org/wiki/Races" target="_blank" rel="noopener noreferrer">wiki&apos;s Races page</a>, which add up to 100%. If any of several races would do, their chances add up, then the same tries maths applies.<F>p = sum of the chances of the races you want</F><span className="muted">Any Legendary or better: 5 × 1.25% + 4 × 0.25% + 2 × 0.1% = 7.45%. That&apos;s 1 ÷ 0.0745 = <b className="gold">13.4 spins</b> on average, half of players within <b className="gold">9</b> and 9 in 10 within <b className="gold">30</b>. The wiki says luck buffs don&apos;t change race spins. <Link href="/races" className="inline-link">Race spin calculator</Link></span></> },
  { title: "Worked example", badge: "ok", body: <>Dark Knight Chestplate (health 25%) at M = 12.51 and 100% quality: 2 × 25 × 12.51 = 625.5, shown as <b className="gold">626 DEF</b>. At +10 it reaches about 938 DEF. Hachiwari (base 8.25) at M = 10.88: 2 × 8.25 × 10.88 = <b className="gold">179.52 DMG</b>.</> },
];

export default function Page() {
  return (
    <div className="page">
      <h1 className="title" style={{ fontSize: 28 }}>How the forge works</h1>
      <div className="row" style={{ alignItems: "stretch" }}>
        {cards.map((c, i) => (
          <Reveal key={c.title} col={Math.min(4, 1 + Math.floor(i / 2))} style={{ flex: "1 1 400px", minWidth: 0, display: "flex" }}>
            <article className="gp" id={c.id} style={{ flex: 1 }}>
              <div className="tb"><h2 style={{ display: "flex", gap: 12, alignItems: "baseline" }}><span style={{ color: "var(--acc)" }}>{i + 1}</span>{c.title}</h2>{SHOW_STATUS_LABELS && <span className={`badge ${c.badge}`}>{c.badge === "ok" ? "Confirmed in game" : c.badge === "der" ? "Derived" : "Unverified"}</span>}</div>
              <div className="pad" style={{ color: "#cfc7b2" }}>{c.body}</div>
            </article>
          </Reveal>
        ))}
      </div>
      {SHOW_STATUS_LABELS && <p className="note">Confirmed rules match crafts checked in the game. Derived rules were measured with controlled ore mixes. Quality label names and ranges are still unverified.</p>}
    </div>
  );
}

function TraitChart() {
  return (
    <svg viewBox="0 0 520 230" width="100%" style={{ maxWidth: 520, display: "block", marginTop: 10 }} role="img" aria-label="Trait strength against ore share: zero below 10 percent share, 10 percent strength at 10 percent share, rising in a straight line to full strength at 30 percent share">
      <rect x="40" y="10" width="460" height="170" fill="#0e0d0c" stroke="var(--bd)" />
      <g stroke="var(--bd)"><line x1="40" y1="95" x2="500" y2="95" /><line x1="40" y1="52" x2="500" y2="52" /><line x1="40" y1="138" x2="500" y2="138" /></g>
      <polyline points="40,180 155,180 155,163 385,10 500,10" fill="none" stroke="#8a5cc9" strokeWidth="3" />
      <g fill="#a39c8b" fontSize="13" fontFamily="Alegreya, Georgia, serif"><text x="40" y="200">0%</text><text x="145" y="200">10%</text><text x="375" y="200">30%</text><text x="487" y="200">40%</text><text x="6" y="184">0%</text><text x="2" y="14">100%</text><text x="150" y="222">share of the craft</text></g>
    </svg>
  );
}
