import { describe, expect, it } from "vitest";
import { cleanDisplayName, safeNext } from "../lib/safe-next";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/forger")).toBe("/forger");
    expect(safeNext("/?o=kitsunite:5&k=weapon#x")).toBe("/?o=kitsunite:5&k=weapon#x");
  });
  it("refuses anything that leaves the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com", "javascript:alert(1)", "evil.com", "/%0d%0aLocation:evil", "/\u0000x", "", null, undefined, "/" + "a".repeat(400)]) {
      expect(safeNext(bad as string), String(bad)).toBe(bad === "/%0d%0aLocation:evil" ? "/%0d%0aLocation:evil" : "/");
    }
  });
});

describe("cleanDisplayName", () => {
  it("trims, strips angle brackets and control characters, caps at 32", () => {
    expect(cleanDisplayName("  Cris  ")).toBe("Cris");
    expect(cleanDisplayName("<script>x</script>")).toBe("scriptx/script");
    expect(cleanDisplayName("a".repeat(50))).toHaveLength(32);
    expect(cleanDisplayName(" \n\t ")).toBeNull();
  });
});
