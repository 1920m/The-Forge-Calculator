import { describe, expect, it } from "vitest";
import { calculatorHref, cleanForgeName, forgeKey, readSavedForge } from "@/lib/saved-forges";

const row = {
  id: "a1", name: "Dark Knight", kind: "weapon", world: 2, class_name: "Gauntlets", variant_id: "dark-knights-gauntlets",
  quality: 100, ores: [{ id: "gargantuan", count: 3 }, { id: "onyx", count: 3 }], catalogue_revision: 8, created_at: "2026-10-25T10:00:00Z",
};

describe("readSavedForge", () => {
  it("reads a good row", () => {
    expect(readSavedForge(row)).toMatchObject({ id: "a1", kind: "weapon", world: 2, ores: [{ id: "gargantuan", count: 3 }, { id: "onyx", count: 3 }] });
  });
  it("drops malformed rows", () => {
    for (const bad of [null, "x", { ...row, kind: "spell" }, { ...row, world: 9 }, { ...row, quality: 0 }, { ...row, variant_id: "<x>" },
      { ...row, class_name: "a<b" }, { ...row, ores: [] }, { ...row, ores: "gargantuan:3" }, { ...row, name: "<>" }, { ...row, id: 5 }]) {
      expect(readSavedForge(bad)).toBeNull();
    }
  });
  it("cleans ores it can't trust", () => {
    const f = readSavedForge({ ...row, ores: [{ id: "a", count: 500 }, { id: "a", count: 1 }, { id: "BAD", count: 2 }, { id: "b", count: 0 }] });
    expect(f?.ores).toEqual([{ id: "a", count: 99 }]);
  });
});

describe("cleanForgeName", () => {
  it("strips markup and control characters, trims and caps at 40", () => {
    expect(cleanForgeName("  <b>Big</b>\u0000 sword ")).toBe("bBig/b sword");
    expect(cleanForgeName("x".repeat(60))).toHaveLength(40);
    expect(cleanForgeName(" <> ")).toBeNull();
  });
});

describe("forgeKey", () => {
  it("ignores ore order", () => {
    const a = readSavedForge(row)!;
    expect(forgeKey(a)).toBe(forgeKey({ ...a, ores: [...a.ores].reverse() }));
    expect(forgeKey(a)).not.toBe(forgeKey({ ...a, quality: 90 }));
  });
});

describe("calculatorHref", () => {
  it("links to the exact forge", () => {
    const u = new URL(calculatorHref(readSavedForge(row)!), "https://x.invalid");
    expect(u.pathname).toBe("/");
    expect(Object.fromEntries(u.searchParams)).toEqual({ o: "gargantuan:3,onyx:3", k: "weapon", q: "100", world: "2", c: "Gauntlets", v: "dark-knights-gauntlets" });
  });
});
