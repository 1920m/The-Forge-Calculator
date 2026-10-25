"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth";
import { useSavedForges } from "./saved-forges";
import { forgeKey, type NewForge } from "@/lib/saved-forges";

type Note = { text: string; link?: boolean; bad?: boolean };

/** The ☆ in the forge panel's corner. Saves this forge to the player's Forger page; pressing ★ again removes it. */
export function SaveStar({ forge }: { forge: NewForge | null }) {
  const { user, loading: authLoading } = useAuth();
  const { forges, loading, save, remove } = useSavedForges();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  const key = forge ? forgeKey(forge) : null;
  const saved = useMemo(() => (key ? forges.find((f) => forgeKey(f) === key) ?? null : null), [forges, key]);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), note.bad ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [note]);

  const onClick = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!forge || busy || loading) return;
    setBusy(true);
    if (saved) {
      const err = await remove(saved.id);
      setNote(err ? { text: err, bad: true } : { text: "Removed from your Forger page." });
    } else {
      const res = await save(forge);
      setNote(typeof res === "string" ? { text: res, bad: true } : { text: "Saved to your", link: true });
    }
    setBusy(false);
  };

  const signedOut = !authLoading && !user;
  const label = signedOut ? "Sign in to save this forge"
    : !forge ? "Add 3 or more ores to save a forge"
    : saved ? `Saved as ${saved.name}. Press to remove it from your Forger page`
    : "Save this forge to your Forger page";

  return (
    <div className="star-wrap">
      <button type="button" className={`star-btn${saved ? " on" : ""}`} onClick={onClick} aria-pressed={!!saved} aria-label={label} title={label}
        disabled={authLoading || (!!user && (!forge || loading)) || busy} aria-busy={busy}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" />
        </svg>
      </button>
      <div className="star-note" role="status" aria-live="polite">
        {note && <span className={`star-note-in${note.bad ? " bad" : ""}`}>{note.text}{note.link && <> <Link href="/forger">Forger page</Link>.</>}</span>}
      </div>
    </div>
  );
}
