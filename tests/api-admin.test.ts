import { describe, expect, it } from "vitest";
import { ago, checkNewKey, keyStatus, maskKey } from "../lib/api/admin";

const now = Date.parse("2026-11-04T12:00:00Z");

describe("dashboard helpers", () => {
  it("works out a key's status", () => {
    expect(keyStatus({ revoked_at: null, expires_at: null }, now)).toBe("active");
    expect(keyStatus({ revoked_at: "2026-11-01T00:00:00Z", expires_at: null }, now)).toBe("revoked");
    expect(keyStatus({ revoked_at: null, expires_at: "2026-11-04T11:00:00Z" }, now)).toBe("expired");
    expect(keyStatus({ revoked_at: null, expires_at: "2026-11-05T12:00:00Z" }, now)).toBe("expiring");
    expect(keyStatus({ revoked_at: null, expires_at: "2027-01-01T00:00:00Z" }, now)).toBe("active");
  });
  it("masks keys and says how long ago", () => {
    expect(maskKey("fc_live_AbCd")).toBe("fc_live_AbCd••••••••");
    expect(ago(null, now)).toBe("never");
    expect(ago("2026-11-04T11:57:00Z", now)).toBe("3 minutes ago");
    expect(ago("2026-11-02T12:00:00Z", now)).toBe("2 days ago");
  });
  it("checks the new-key form", () => {
    const ok = { label: "Discord bot", scopes: ["catalogue:read"], catalogueRpm: 60, calculatorRpm: 120, expires: "" };
    expect(checkNewKey(ok, now)).toBeNull();
    expect(checkNewKey({ ...ok, label: " " }, now)).toMatch(/name/);
    expect(checkNewKey({ ...ok, label: "<b>" }, now)).toMatch(/name/);
    expect(checkNewKey({ ...ok, scopes: [] }, now)).toMatch(/permission/);
    expect(checkNewKey({ ...ok, calculatorRpm: 0 }, now)).toMatch(/Limits/);
    expect(checkNewKey({ ...ok, expires: "2026-11-01" }, now)).toMatch(/future/);
  });
});
