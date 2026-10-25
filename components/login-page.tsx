"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, type Provider } from "./auth";
import { safeNext } from "@/lib/safe-next";

const ERRORS: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  callback: "Sign-in didn't finish. Please try again.",
};

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(() => {
    const e = params.get("error");
    return e ? ERRORS[e] ?? ERRORS.callback : null;
  });

  // Already signed in: go straight on.
  useEffect(() => { if (!loading && user) router.replace(next); }, [loading, user, next, router]);

  const go = async (provider: Provider) => {
    setBusy(provider);
    setError(null);
    const err = await signIn(provider, next);
    if (err) { setError("Couldn't start sign-in. Please try again."); setBusy(null); }
  };

  return (
    <div className="page">
      <section className="gp login" aria-labelledby="login-h">
        <div className="tb"><h1 id="login-h" className="title">Sign in</h1></div>
        <div className="pad">
          <p className="login-lead">Sign in to save forges with the ☆ on the calculator and build your loadout on your Forger page. Everything else works without an account.</p>
          <div className="login-buttons">
            <button className="btn login-btn" onClick={() => go("google")} disabled={busy !== null} aria-busy={busy === "google"}>
              <GoogleMark /> {busy === "google" ? "Opening Google…" : "Continue with Google"}
            </button>
            <button className="btn login-btn discord" onClick={() => go("discord")} disabled={busy !== null} aria-busy={busy === "discord"}>
              <DiscordMark /> {busy === "discord" ? "Opening Discord…" : "Continue with Discord"}
            </button>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <p className="note">Email sign-in is coming soon. We only keep your name, picture and email from the account you choose, and your saved forges are private to you. See the <Link href="/privacy" style={{ textDecoration: "underline" }}>privacy page</Link>.</p>
        </div>
      </section>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.8-3.8-13.7zM8.7 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm6.6 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
    </svg>
  );
}
