"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth";

/** Header button: "Sign in", or the player's avatar with a small menu once signed in. */
export function AccountMenu() {
  const { user, profile, loading, signOut } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (loading) return <span className="account-slot" aria-hidden="true" />;
  if (!user) {
    const next = path && path !== "/login" ? path : "/";
    return <Link className="btn sm account-signin" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>;
  }

  const name = profile?.display_name ?? "Forger";
  return (
    <div className="account" ref={wrap}>
      <button className="account-btn" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)} title={name}>
        <Avatar name={name} url={profile?.avatar_url ?? null} size={32} />
      </button>
      {open && (
        <div className="account-menu gp" id={menuId} role="menu">
          <div className="account-name">{name}</div>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)}>Settings</Link>
          <button role="menuitem" className="link-btn" onClick={() => { setOpen(false); void signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

/** Player picture from Google or Discord, or their first letter. */
export function Avatar({ name, url, size }: { name: string; url: string | null; size: number }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="avatar avatar-letter" style={{ width: size, height: size, fontSize: size * 0.48 }} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}
