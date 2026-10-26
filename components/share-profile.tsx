"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { SHARE_ID, shareUrl } from "@/lib/shared-profile";

/**
 * "Share profile" on the Forger page. Sharing is off until the player turns it on; then anyone with the link sees
 * their name, picture and loadout. Stopping deletes the link id, so an old link stops working.
 */
export function ShareProfile({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    let alive = true;
    void supabase().from("profiles").select("share_id").eq("id", userId).maybeSingle().then(({ data }) => {
      const id = (data as { share_id?: unknown } | null)?.share_id;
      if (alive) setShareId(typeof id === "string" && SHARE_ID.test(id) ? id : null);
    });
    return () => { alive = false; };
  }, [userId]);

  // Escape or a click outside closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  useEffect(() => { if (!copied) return; const t = window.setTimeout(() => setCopied(false), 2000); return () => clearTimeout(t); }, [copied]);

  const url = shareId ? shareUrl(window.location.origin, shareId) : "";

  const setSharing = async (enabled: boolean) => {
    setBusy(true); setError(null);
    const { data, error: err } = await supabase().rpc("set_profile_sharing", { enabled });
    setBusy(false); setConfirmStop(false);
    if (err) { setError("Couldn't change sharing. Please try again."); return; }
    setShareId(enabled && typeof data === "string" && SHARE_ID.test(data) ? data : null);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { field.current?.select(); setError("Press Ctrl+C (or ⌘C) to copy the selected link."); }
  };

  return (
    <div className="share-wrap" ref={box}>
      <button className={`btn share-btn${shareId ? " on" : ""}`} aria-expanded={open} aria-controls={titleId} onClick={() => { setOpen((o) => !o); setError(null); setConfirmStop(false); }}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 12h8M12 8l4 4-4 4M4 5v14h16" /></svg>
        Share profile
      </button>
      {open && (
        <div className="share-pop gp" id={titleId} role="dialog" aria-label="Share profile">
          {shareId ? (
            <>
              <p className="share-lead">Anyone with this link can see your name, picture and loadout.</p>
              <div className="share-link">
                <input ref={field} className="input" readOnly value={url} aria-label="Your profile link" onFocus={(e) => e.target.select()} />
                <button className="btn gb" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
              </div>
              <div className="share-actions">
                <a className="inline-link small" href={url} target="_blank" rel="noopener noreferrer">Open it</a>
                <button className="btn sm ghost danger-btn" disabled={busy} onClick={() => (confirmStop ? void setSharing(false) : setConfirmStop(true))}>
                  {confirmStop ? "Sure? The link stops working" : "Stop sharing"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="share-lead">Make a link to your profile. Anyone with it will see your <b>name</b>, <b>picture</b> and <b>loadout</b>. Your other saved forges stay private, and you can turn the link off at any time.</p>
              <div className="share-actions">
                <button className="btn gb" disabled={busy} onClick={() => void setSharing(true)}>{busy ? "Making link…" : "Make my link"}</button>
                <button className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </>
          )}
          {error && <p className="login-error small" role="alert" style={{ margin: "8px 0 0" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
