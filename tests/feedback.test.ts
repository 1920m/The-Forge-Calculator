import { describe, expect, it } from "vitest";
import { FEEDBACK_KINDS, cleanMessage, fileExt, friendlyFeedbackError } from "@/lib/feedback";

describe("feedback", () => {
  it("offers the four types the database accepts", () => {
    expect(FEEDBACK_KINDS.map((k) => k.id)).toEqual(["bug", "feature", "other", "praise"]);
  });
  it("only accepts the image types the bucket allows", () => {
    expect(fileExt("image/png")).toBe("png");
    expect(fileExt("image/jpeg")).toBe("jpg");
    expect(fileExt("image/webp")).toBe("webp");
    expect(fileExt("image/svg+xml")).toBeNull();
    expect(fileExt("text/html")).toBeNull();
  });
  it("cleans messages but keeps line breaks", () => {
    expect(cleanMessage("  hi\u0000 there\n\nline two\u0007  ")).toBe("hi there\n\nline two");
    expect(cleanMessage("x".repeat(3000))).toHaveLength(2000);
  });
  it("explains the spam limit kindly", () => {
    expect(friendlyFeedbackError("Too many reports from here. Please try again in an hour.")).toMatch(/hour/);
    expect(friendlyFeedbackError(undefined)).toMatch(/try again/);
  });
});
