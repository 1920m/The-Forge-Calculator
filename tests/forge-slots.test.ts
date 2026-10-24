import { describe, expect, it } from "vitest";
import { MAX_TYPES, addOre, type Entry } from "../lib/forge-slots";

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
