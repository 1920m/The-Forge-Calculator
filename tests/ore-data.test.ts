import { describe, expect, it } from "vitest";
import { loadOres, parseOreRecords } from "../lib/data/ores";
import snapshot from "../lib/data/ores.snapshot.json";

describe("public ore catalogue", () => {
  it("keeps confirmed corrections and unknown eligibility in the bundled fallback", async () => {
    const result = await loadOres(null);
    expect(result.source).toBe("bundled");
    expect(result.ores).toHaveLength(150);
    expect(result.ores.find(ore => ore.name === "Aite")?.multiplier).toBe(1.1);
    expect(result.ores.find(ore => ore.name === "Arcane Crystal")?.multiplier).toBe(9);
    expect(result.ores.find(ore => ore.name === "Fichillium")?.forgeable).toBeNull();
    expect(result.ores.find(ore => ore.name === "Zephyte")?.confidence).toBe("unknown");
  });
  it("rejects unsafe or ambiguous records", () => {
    expect(() => parseOreRecords([...snapshot, snapshot[0]])).toThrow();
    expect(() => parseOreRecords([{...snapshot[0], multiplier: -1}])).toThrow();
    expect(() => parseOreRecords([{...snapshot[0], worlds: [5]}])).toThrow();
    expect(() => parseOreRecords([{...snapshot[0], image_path: "https://other.test/image.png"}])).toThrow();
  });
  it("uses the fallback when the database returns malformed data", async () => {
    const fakeFetch = (async () => Response.json([{...snapshot[0], multiplier: "unknown"}])) as typeof fetch;
    const result = await loadOres({url:"https://test.supabase.co",key:"sb_publishable_test",imageHost:"test.supabase.co"},fakeFetch);
    expect(result.source).toBe("bundled");
    expect(result.ores).toHaveLength(150);
  });
  it("returns validated public data when Supabase is available", async () => {
    const fakeFetch = (async () => Response.json(snapshot)) as typeof fetch;
    expect((await loadOres({url:"https://test.supabase.co",key:"sb_publishable_test",imageHost:"test.supabase.co"},fakeFetch)).source).toBe("supabase");
  });
});
