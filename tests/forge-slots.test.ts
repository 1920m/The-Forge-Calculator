import { describe, expect, it } from "vitest";
import { MAX_TYPES, addOre, parseRecipe, type Entry } from "../lib/forge-slots";

describe("forge slots", () => {
  it("holds at most four ore types, but any count of each", () => {
    let e: Entry[] = [];
    for (const id of ["a", "b", "c", "d"]) e = addOre(e, id, 9);
    expect(e).toHaveLength(MAX_TYPES);
    expect(addOre(e, "e")).toBe(e); // fifth type refused
    expect(addOre(e, "a", 5).find((x) => x.id === "a")?.count).toBe(14); // more of an existing type is fine
  });
  it("frees a slot when an ore is removed", () => {
    let e: Entry[] = [{ id: "a", count: 1 }, { id: "b", count: 2 }, { id: "c", count: 3 }, { id: "d", count: 4 }];
    e = addOre(e, "a", -1);
    expect(e).toHaveLength(3);
    expect(addOre(e, "e")).toHaveLength(4);
  });
});

describe("recipe links", () => {
  it("merges repeated ores instead of crashing the calculator", () => {
    expect(parseRecipe("kitsunite:1,kitsunite:2,galaxite:3")).toEqual([{ id: "kitsunite", count: 3 }, { id: "galaxite", count: 3 }]);
    expect(parseRecipe(Array.from({ length: 100 }, (_, i) => `kitsunite:${i}`).join(","))).toEqual([{ id: "kitsunite", count: 99 }]);
    expect(parseRecipe(Array.from({ length: 400 }, (_, i) => `kitsunite:${i}`).join(","))).toEqual([]); // over the length cap
  });
  it("drops anything that is not a plain ore id with a whole count from 1 to 99", () => {
    expect(parseRecipe("<img src=x onerror=alert(1)>:5,__proto__:5,constructor:2,kitsunite:5")).toEqual([{ id: "constructor", count: 2 }, { id: "kitsunite", count: 5 }]);
    expect(parseRecipe("a:0,b:-4,c:NaN,d:1e309,e:2.9,f:999")).toEqual([{ id: "e", count: 2 }, { id: "f", count: 99 }]);
    expect(parseRecipe("a:1,b:1,c:1,d:1,e:1")).toHaveLength(4);
    expect(parseRecipe("a".repeat(3000) + ":5")).toEqual([]);
    expect(parseRecipe(null)).toEqual([]);
  });
  it("can be limited to known ores", () => {
    expect(parseRecipe("kitsunite:5,madeup:5", (id) => id === "kitsunite")).toEqual([{ id: "kitsunite", count: 5 }]);
  });
});
