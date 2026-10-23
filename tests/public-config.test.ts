import { describe, expect, it } from "vitest";
import { publicDataConfig } from "../lib/data/config";

const legacy = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role }))}.signature`;

describe("public Supabase configuration", () => {
  it("allows a scaffold and offline build without credentials", () => {
    expect(publicDataConfig({})).toBeNull();
    expect(publicDataConfig({ url: "https://example.supabase.co" })).toBeNull();
  });
  it("accepts publishable and legacy anon keys", () => {
    expect(publicDataConfig({ url: "https://example.supabase.co", key: "sb_publishable_example" })?.imageHost).toBe("example.supabase.co");
    expect(publicDataConfig({ url: "https://example.supabase.co/", key: legacy("anon") })?.url).toBe("https://example.supabase.co");
  });
  it.each(["sb_secret_example", legacy("service_role"), "unknown-key", "eyJ.invalid.signature"])("rejects non-public credentials", (key) => {
    expect(() => publicDataConfig({ url: "https://example.supabase.co", key })).toThrow();
  });
  it.each(["not-a-url", "http://example.supabase.co", "https://supabase.co.evil.example", "https://user:password@example.supabase.co", "https://example.supabase.co/extra", "https://example.supabase.co?secret=test"])("rejects unsafe project origins", (url) => {
    expect(() => publicDataConfig({ url, key: "sb_publishable_example" })).toThrow();
  });
});
