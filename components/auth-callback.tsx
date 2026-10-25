"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { safeNext } from "@/lib/safe-next";

/**
 * Google or Discord sends the player back here with a one-time code. The Supabase client swaps it for a
 * session as it starts (PKCE), so this waits for that and then goes on to a page on this site.
 */
export function AuthCallback() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const next = safeNext(params.get("next"));
    const providerError = params.get("error");
    let done = false;
    (async () => {
      if (providerError) { router.replace(`/login?error=${providerError === "access_denied" ? "access_denied" : "callback"}&next=${encodeURIComponent(next)}`); return; }
      const { data } = await supabase().auth.getSession();
      if (done) return;
      router.replace(data.session ? next : `/login?error=callback&next=${encodeURIComponent(next)}`);
    })();
    return () => { done = true; };
  }, [params, router]);

  return (
    <div className="page">
      <section className="gp login"><div className="pad"><p className="muted" style={{ margin: 0 }} role="status">Signing you in…</p></div></section>
    </div>
  );
}
