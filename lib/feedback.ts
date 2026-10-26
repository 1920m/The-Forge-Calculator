/** The "Send feedback" window: types, limits and the checks the database also makes. */

export type FeedbackKind = "bug" | "feature" | "other" | "praise";

export const FEEDBACK_KINDS: { id: FeedbackKind; label: string; placeholder: string }[] = [
  { id: "bug", label: "Bug", placeholder: "What went wrong? What did you expect to happen? (A wrong number counts too: tell us the item, ores and what the game shows.)" },
  { id: "feature", label: "Feature", placeholder: "What would you like the calculator to do?" },
  { id: "other", label: "Other", placeholder: "What's on your mind?" },
  { id: "praise", label: "Praise", placeholder: "What do you like? It makes our day." },
];

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Images only, the same three types the storage bucket accepts. */
export function fileExt(type: string): "png" | "jpg" | "webp" | null {
  return type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : null;
}

/** Trims, drops control characters (keeping new lines and tabs) and caps at 2000 characters. */
export function cleanMessage(raw: string): string {
  return raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 2000);
}

/** Turns database and storage errors into something a player can act on. */
export function friendlyFeedbackError(msg: string | undefined): string {
  if (msg?.includes("Too many reports")) return "You've sent a few reports already. Please try again in an hour.";
  if (msg?.includes("busy")) return "Feedback is busy right now. Please try again tomorrow.";
  if (msg && /size|too large|exceeded/i.test(msg)) return "One of the images is too big. Each must be 5 MB or smaller.";
  return "Couldn't send your feedback. Please check your connection and try again.";
}
