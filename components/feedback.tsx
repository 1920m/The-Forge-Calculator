"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/browser";
import { FEEDBACK_KINDS, MAX_FILES, MAX_FILE_BYTES, cleanMessage, fileExt, friendlyFeedbackError, type FeedbackKind } from "@/lib/feedback";

/* ------------------------------------------------------------------ opening it from anywhere */

const Ctx = createContext<(kind?: FeedbackKind) => void>(() => {});
/** Opens the feedback window, optionally on a type (e.g. "bug" from the result card). */
export const useFeedback = () => useContext(Ctx);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<FeedbackKind | null>(null);
  const show = useCallback((kind: FeedbackKind = "bug") => setOpen(kind), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {open && <FeedbackDialog initialKind={open} onClose={() => setOpen(null)} />}
    </Ctx.Provider>
  );
}

/** A text-style button that opens the window (footer, result card). */
export function FeedbackLink({ kind, children, className }: { kind?: FeedbackKind; children: React.ReactNode; className?: string }) {
  const open = useFeedback();
  return <button type="button" className={`link-btn ${className ?? ""}`} onClick={() => open(kind)}>{children}</button>;
}

/* ------------------------------------------------------------------ the window */

const APP_VERSION = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7);

type Picked = { file: File; key: string };

function FeedbackDialog({ initialKind, onClose }: { initialKind: FeedbackKind; onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>(initialKind);
  const [message, setMessage] = useState("");
  const [context, setContext] = useState(true);
  const [files, setFiles] = useState<Picked[]>([]);
  const [trap, setTrap] = useState(""); // hidden field only bots fill in
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const kindInfo = FEEDBACK_KINDS.find((k) => k.id === kind)!;
  const ready = cleanMessage(message).length >= 3 && state === "idle";

  // Escape closes; focus moves into the window and back to the button that opened it.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("modal-open"); before?.focus?.(); };
  }, [onClose]);


  const pick = (list: FileList | null) => {
    let problem: string | null = null;
    const add: Picked[] = [];
    for (const file of Array.from(list ?? [])) {
      if (!fileExt(file.type)) { problem = "Only PNG, JPG or WebP images can be attached."; continue; }
      if (file.size > MAX_FILE_BYTES) { problem = "Each image must be 5 MB or smaller."; continue; }
      if (files.length + add.length >= MAX_FILES) { problem = `You can attach up to ${MAX_FILES} images.`; break; }
      add.push({ file, key: crypto.randomUUID() });
    }
    setError(problem);
    if (add.length) setFiles([...files, ...add]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setState("sending");
    setError(null);
    if (trap) { setState("sent"); return; } // a bot filled the hidden field: pretend it worked
    const sb = supabase();
    const id = crypto.randomUUID();
    const paths: string[] = [];
    try {
      for (const [i, { file }] of files.entries()) {
        const path = `${id}/${i + 1}.${fileExt(file.type)}`;
        const { error: up } = await sb.storage.from("feedback-files").upload(path, file, { contentType: file.type, upsert: false });
        if (up) throw new Error(up.message);
        paths.push(path);
      }
      const { error: err } = await sb.from("feedback").insert({
        id, kind, message: cleanMessage(message), app_version: APP_VERSION, files: paths,
        page: context ? (window.location.pathname + window.location.search).slice(0, 500) : null,
        browser: context ? navigator.userAgent.slice(0, 300) : null,
      });
      if (err) throw new Error(err.message);
      setState("sent");
    } catch (err) {
      setError(friendlyFeedbackError((err as Error).message));
      setState("idle");
    }
  };

  return createPortal(
    <div className="fb-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fb gp" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box}>
        <div className="fb-head">
          <h2 id={titleId} className="fb-title">{state === "sent" ? "Thank you" : "Send feedback"}</h2>
          <button type="button" className="fb-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>

        {state === "sent" ? (
          <div className="fb-done">
            <span className="fb-done-mark"><Icon name="check" /></span>
            <p>Your {kindInfo.label.toLowerCase()} report reached the developer.{kind === "praise" ? " It made our day." : " We read every one."}</p>
            <button type="button" className="btn gb fb-send" onClick={onClose} data-autofocus>Close</button>
          </div>
        ) : (
          <form onSubmit={send} className="fb-form">
            <div className="fb-kinds" role="radiogroup" aria-label="Type of feedback">
              {FEEDBACK_KINDS.map((k, i) => (
                <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`fb-kind${kind === k.id ? " on" : ""}`}
                  onClick={() => setKind(k.id)} data-autofocus={i === 0 ? true : undefined}>
                  <Icon name={k.id} />
                  <span>{k.label}</span>
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor={`${titleId}-msg`}>Your feedback</label>
            <textarea id={`${titleId}-msg`} className="input fb-text" value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder={kindInfo.placeholder} maxLength={2000} rows={6} />
            <div className="fb-count small faint" aria-live="polite">{message.length > 1500 ? `${2000 - message.length} characters left` : ""}</div>

            <div className="fb-note"><Icon name="eye" /><span>We read every report. Most fixes go live within days.</span></div>

            <label className="fb-check">
              <input type="checkbox" checked={context} onChange={(e) => setContext(e.target.checked)} />
              <span className="fb-box" aria-hidden="true"><Icon name="tick" /></span>
              <span>Include page context (the page you&apos;re on and your browser). The app version is always sent.</span>
            </label>

            <div className="fb-files">
              {files.map((f, i) => (
                <span key={f.key} className="fb-thumb">
                  <Thumb file={f.file} label={`Attachment ${i + 1}`} />
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((x) => x !== f))} aria-label={`Remove attachment ${i + 1}`}><Icon name="x" /></button>
                </span>
              ))}
              {files.length < MAX_FILES && (
                <button type="button" className="btn fb-attach" onClick={() => fileInput.current?.click()}>
                  <Icon name="clip" /> {files.length ? "Add another" : "Attach files"}
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
            </div>

            {/* Bots fill every field; people never see this one. */}
            <input className="fb-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />

            {error && <p className="login-error fb-error" role="alert">{error}</p>}

            <div className="fb-actions">
              <button type="submit" className="btn gb fb-send" disabled={!ready} aria-busy={state === "sending"}>
                {state === "sending" ? (files.length ? "Uploading…" : "Sending…") : "Send feedback"}
              </button>
              <button type="button" className="btn fb-cancel" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>,
    // Inside the themed app (so it uses the current world's colours), above the falling petals.
    document.querySelector(".app") ?? document.body,
  );
}

/** Draws a small preview of a picked image onto a canvas (no page addresses built from the file). */
function Thumb({ file, label }: { file: File; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    createImageBitmap(file).then((bmp) => {
      const c = ref.current;
      if (!alive || !c) { bmp.close(); return; }
      const size = 128, scale = Math.max(size / bmp.width, size / bmp.height);
      const w = bmp.width * scale, h = bmp.height * scale;
      c.width = size; c.height = size;
      c.getContext("2d")?.drawImage(bmp, (size - w) / 2, (size - h) / 2, w, h);
      bmp.close();
    }).catch(() => {});
    return () => { alive = false; };
  }, [file]);
  return <canvas ref={ref} role="img" aria-label={label} />;
}

/* ------------------------------------------------------------------ icons (outline, like the rest of the site) */

const PATHS: Record<string, string> = {
  bug: "M8 9a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0zM12 9v9M8 12H4M20 12h-4M8 16l-3 2M16 16l3 2M8 8 5.5 6M16 8l2.5-2M9.5 5.5 8 3.5M14.5 5.5 16 3.5",
  feature: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.4.3.6.8.6 1.2v1h6v-1c0-.4.2-.9.6-1.2A6 6 0 0 0 12 3z",
  other: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  praise: "M11 4l1.6 4.4L17 10l-4.4 1.6L11 16l-1.6-4.4L5 10l4.4-1.6zM18 3l.7 1.8L20.5 5.5l-1.8.7L18 8l-.7-1.8-1.8-.7 1.8-.7z",
  eye: "M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  clip: "M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5",
  x: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  tick: "M5 12.5l4.5 4.5L19 7.5",
};

function Icon({ name }: { name: string }) {
  return <svg className={`fb-icon fb-icon-${name}`} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={PATHS[name]} /></svg>;
}
