"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth";
import { Avatar } from "./account-menu";
import { supabase } from "@/lib/supabase/browser";
import { cleanDisplayName } from "@/lib/safe-next";

export function SettingsPage() {
  const { user, profile, loading, reloadProfile, signOut } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null); // null until the player types
  const [saved, setSaved] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) router.replace("/login?next=%2Fsettings"); }, [loading, user, router]);

  const name = draft ?? profile?.display_name ?? "";
  if (loading || !user) return <div className="page"><p className="muted">Loading…</p></div>;

  const provider = (user.app_metadata?.provider as string | undefined) ?? "account";
  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSaved(null);
    const clean = cleanDisplayName(name);
    if (!clean) { setError("Your name needs at least one letter."); return; }
    const { error: err } = await supabase().from("profiles").update({ display_name: clean }).eq("id", user.id);
    if (err) { setError("Couldn't save your name. Please try again."); return; }
    await reloadProfile();
    setDraft(null);
    setSaved("Saved.");
  };

  const deleteAccount = async () => {
    setDeleting(true); setError(null);
    const { error: err } = await supabase().rpc("delete_my_account");
    if (err) { setError("Couldn't delete your account. Please try again."); setDeleting(false); return; }
    await signOut();
    router.replace("/?account=deleted");
  };

  return (
    <div className="page settings">
      <section className="gp" aria-labelledby="profile-h">
        <div className="tb"><h1 id="profile-h" className="title">Settings</h1></div>
        <div className="pad">
          <div className="settings-who">
            <Avatar name={profile?.display_name ?? "Forger"} url={profile?.avatar_url ?? null} size={56} />
            <div><div className="strong" style={{ fontWeight: 700 }}>{profile?.display_name ?? "Forger"}</div><div className="small muted">Signed in with {provider === "google" ? "Google" : provider === "discord" ? "Discord" : provider}</div></div>
          </div>
          <form onSubmit={saveName} className="settings-form">
            <label htmlFor="display-name" className="small muted">Display name</label>
            <div className="settings-row">
              <input id="display-name" className="input" value={name} maxLength={32} onChange={(e) => { setDraft(e.target.value); setSaved(null); }} autoComplete="nickname" />
              <button className="btn" type="submit">Save</button>
            </div>
            {saved && <p className="small" style={{ color: "#8fd19b", margin: "6px 0 0" }} role="status">{saved}</p>}
          </form>
        </div>
      </section>

      <section className="gp danger" aria-labelledby="delete-h">
        <div className="tb"><h2 id="delete-h">Delete account</h2></div>
        <div className="pad">
          <p style={{ marginTop: 0, color: "#cfc7b2" }}>This deletes your account, your saved forges and your loadout straight away. It can&apos;t be undone.</p>
          <label htmlFor="confirm-delete" className="small muted">Type DELETE to confirm</label>
          <div className="settings-row">
            <input id="confirm-delete" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            <button className="btn danger-btn" disabled={confirm !== "DELETE" || deleting} onClick={deleteAccount}>{deleting ? "Deleting…" : "Delete my account"}</button>
          </div>
        </div>
      </section>
      {error && <p className="login-error" role="alert">{error}</p>}
    </div>
  );
}
