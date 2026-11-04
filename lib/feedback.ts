/** The "Send feedback" window: types, limits and the checks the database also makes. */

export type FeedbackKind = "bug" | "feature" | "other" | "praise";

export const FEEDBACK_KINDS: { id: FeedbackKind; label: string; placeholder: string }[] = [
  { id: "bug", label: "Bug", placeholder: "What went wrong? What did you expect to happen? (A wrong number counts too: tell us the item, ores and what the game shows.)" },
  { id: "feature", label: "Feature", placeholder: "What would you like the calculator to do?" },
  { id: "other", label: "Other", placeholder: "What's on your mind?" },
  { id: "praise", label: "Praise", placeholder: "What do you like? It makes our day." },
];

export const MAX_FILES = 3;
/** Largest image a player can pick; it's shrunk in the browser before uploading. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Largest upload the storage bucket accepts (the database checks the same). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

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
  if (msg && /size|too large|exceeded/i.test(msg)) return "One of the images is too big, even after shrinking it. Try a smaller screenshot.";
  if (msg?.includes("row-level security")) return "Lots of screenshots have been sent today. Please send your feedback without images, or try again tomorrow.";
  return "Couldn't send your feedback. Please check your connection and try again.";
}

/**
 * Shrinks a screenshot to a WebP of at most 1920 pixels across and under the upload limit, trying lower quality
 * and size if needed. Browser only. Returns null if the image can't be read or made small enough.
 */
export async function shrinkImage(file: Blob): Promise<Blob | null> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { return null; }
  try {
    for (const [side, quality] of [[1920, 0.85], [1600, 0.75], [1280, 0.7], [1024, 0.6]] as const) {
      const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bmp.width * k));
      canvas.height = Math.max(1, Math.round(bmp.height * k));
      canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const out = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", quality));
      if (out && out.type === "image/webp" && out.size <= MAX_UPLOAD_BYTES) return out;
    }
    return null;
  } finally { bmp.close(); }
}
