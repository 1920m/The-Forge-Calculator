"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Google's own "Sign in with Google" button (Google Identity Services). It runs on this site, so Google's window
 * says "Sign in to the-forge-calculator.vercel.app" (or "Forge Calculator" once Google verifies the brand) instead
 * of the database's address. Google hands back a signed ID token, which Supabase checks and turns into a session.
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "581482070110-8abicdkpqha53mueqfms9ns1oppqsoka.apps.googleusercontent.com";
const GIS_SRC = "https://accounts.google.com/gsi/client";

type GisCredential = { credential?: string };
type Gis = {
  initialize: (o: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  cancel: () => void;
};
declare global { interface Window { google?: { accounts?: { id?: Gis } } } }

let loading: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<Gis>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google sign-in didn't start")));
    s.onerror = () => { loading = null; s.remove(); reject(new Error("Couldn't reach Google")); };
    document.head.appendChild(s);
  });
  return loading;
}

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/**
 * A one-time random value. Google puts its SHA-256 inside the token; Supabase hashes the raw value we send and
 * checks they match, so a token copied from somewhere else can't be replayed here.
 */
async function makeNonce() {
  const raw = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const hashed = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  return { raw, hashed };
}

export function GoogleButton({ onToken, disabled }: { onToken: (token: string, nonce: string) => void; disabled?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  useEffect(() => { cb.current = onToken; }, [onToken]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [gis, nonce] = await Promise.all([loadGis(), makeNonce()]);
        if (!alive || !box.current) return;
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          callback: (r: GisCredential) => { if (r.credential) cb.current(r.credential, nonce.raw); },
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
          use_fedcm_for_button: true,
        });
        gis.renderButton(box.current, {
          type: "standard", theme: "filled_black", size: "large", text: "continue_with", shape: "rectangular",
          logo_alignment: "center", width: Math.min(400, Math.max(220, Math.floor(box.current.clientWidth))),
        });
        setState("ready");
      } catch {
        if (alive) setState("failed");
      }
    })();
    return () => { alive = false; window.google?.accounts?.id?.cancel(); };
  }, []);

  return (
    <div className="google-slot" aria-busy={state === "loading"} style={disabled ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
      <div ref={box} className="google-btn" />
      {state === "loading" && <div className="google-skeleton" aria-hidden="true" />}
      {state === "failed" && <p className="login-error small" role="alert">Couldn&apos;t load Google sign-in. Check that nothing is blocking accounts.google.com, then reload the page.</p>}
    </div>
  );
}
