"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/browser";
import { SCOPES, ago, checkNewKey, keyStatus, maskKey, type ApiKeyRow, type ApiStats, type KeyStatus } from "@/lib/api/admin";
import { fmt } from "@/lib/ui";
import { useAuth } from "./auth";

/**
 * The API admin dashboard. What it shows comes from database functions that check, on every call, that the signed-in
 * account is the administrator (by account ID). This page only decides what to draw; it isn't the lock.
 */
type Access = "loading" | "signed-out" | "denied" | "admin" | "error";
type Secret = { label: string; key: string; note: string };

const STATUS_TEXT: Record<KeyStatus, string> = { active: "Active", expiring: "Expiring", expired: "Expired", revoked: "Revoked" };
const STATUS_CLASS: Record<KeyStatus, string> = { active: "ok", expiring: "der", expired: "unv", revoked: "unv" };

export function ApiDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<Access>("loading");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [anon, setAnon] = useState<{ on: boolean; rpm: number } | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checked = useRef<string | null | undefined>(undefined); // the account last checked

  const load = useCallback(async () => {
    const db = supabase();
    const [k, s, st] = await Promise.all([db.rpc("api_admin_list_keys"), db.rpc("api_admin_stats"), db.rpc("api_admin_settings")]);
    if (k.error || s.error || st.error) { setError("Couldn't load the API data. Try again in a moment."); return; }
    setKeys((k.data ?? []) as ApiKeyRow[]);
    setStats(s.data as ApiStats);
    const set = st.data as { anonymous_catalogue: boolean; anonymous_catalogue_rpm: number };
    setAnon({ on: set.anonymous_catalogue, rpm: set.anonymous_catalogue_rpm });
    setError(null);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const uid = user?.id ?? null;
    if (uid === checked.current) return;
    checked.current = uid;
    let alive = true;
    const t = window.setTimeout(() => {
      if (!uid) { setAccess("signed-out"); return; }
      void supabase().rpc("api_admin_check").then(async ({ data, error: err }) => {
        if (!alive) return;
        if (err) { setAccess("error"); return; }
        setAccess(data === true ? "admin" : "denied");
        if (data === true) await load();
      });
    }, 0);
    return () => { alive = false; clearTimeout(t); checked.current = undefined; };
  }, [authLoading, user, load]);

  if (access === "loading") return <div className="page"><p className="muted">Loading…</p></div>;
  if (access !== "admin") {
    return (
      <div className="page">
        <section className="gp login">
          <div className="tb"><h1 className="title">API dashboard</h1></div>
          <div className="pad">
            {access === "signed-out" && <><p className="login-lead">This page is for the site&apos;s administrator. Sign in to continue.</p><Link className="btn gb login-btn" href="/login?next=%2Fdevelopers%2Fdashboard">Sign in</Link></>}
            {access === "denied" && <p className="login-lead">Your account doesn&apos;t have access to the API dashboard. To use the API, read the <Link className="inline-link" href="/developers">developer page</Link> and ask for a key.</p>}
            {access === "error" && <p className="login-lead">Couldn&apos;t check your access. Try again in a moment.</p>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page dash">
      <div className="dash-head">
        <h1 className="title">API dashboard</h1>
        <span className="small muted"><Link className="inline-link" href="/developers">Developer docs</Link> · <a className="inline-link" href="/developers#discord">Examples</a> · <button className="link-btn small" onClick={() => void load()}>Refresh</button></span>
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      {secret && <SecretBox secret={secret} onDone={() => setSecret(null)} />}
      {stats && <Overview stats={stats} />}
      <Keys keys={keys} stats={stats} onChanged={load} onSecret={setSecret} onError={setError} />
      {anon && <Settings value={anon} onSaved={load} onError={setError} />}
      {stats && <Activity stats={stats} />}
    </div>
  );
}

/* ------------------------------------------------------------------ overview */

function Overview({ stats }: { stats: ApiStats }) {
  const lat = stats.latency_ms_7d;
  const cards: [string, string, string][] = [
    ["Requests (24 h)", fmt(stats.last_24h, 0), `${fmt(stats.last_7d, 0)} in 7 days`],
    ["Requests (30 days)", fmt(stats.total_30d, 0), "the log keeps 30 days"],
    ["Active keys", fmt(stats.active_keys, 0), "not revoked or expired"],
    ["Failed (7 days)", fmt(stats.failed_7d, 0), "status 400 or higher"],
    ["Rate-limited (7 days)", fmt(stats.rate_limited_7d, 0), "status 429"],
    ["Response time (7 days)", lat?.avg != null ? `${fmt(lat.avg, 0)} ms` : "–", lat?.p95 != null ? `95% under ${fmt(lat.p95, 0)} ms` : "no requests yet"],
  ];
  const days = lastDays(stats.per_day, 14);
  const max = Math.max(1, ...days.map((d) => d.requests));
  return (
    <section className="gp" aria-labelledby="dash-over-h">
      <div className="tb"><h2 id="dash-over-h">Overview</h2></div>
      <div className="pad">
        <div className="dash-cards">
          {cards.map(([label, value, note]) => <div key={label} className="loadout-stat"><span className="small muted">{label}</span><b>{value}</b><span className="small faint">{note}</span></div>)}
        </div>
        <div className="dash-chart" role="img" aria-label={`Requests per day for the last 14 days: ${days.map((d) => `${d.day} ${d.requests}`).join(", ")}`}>
          {days.map((d) => (
            <div key={d.day} className="dash-bar" title={`${d.day}: ${d.requests} requests, ${d.failed} failed`}>
              <span className="dash-bar-fill" style={{ height: `${(d.requests / max) * 100}%` }}><span className="dash-bar-bad" style={{ height: `${d.requests ? (d.failed / d.requests) * 100 : 0}%` }} /></span>
              <span className="dash-bar-day">{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
        <p className="small faint" style={{ margin: "6px 0 0" }}>Requests per day, last 14 days. The red part failed.</p>
      </div>
    </section>
  );
}

function lastDays(rows: ApiStats["per_day"], n: number) {
  const by = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(Date.now() - (n - 1 - i) * 86400000).toISOString().slice(0, 10);
    return by.get(day) ?? { day, requests: 0, failed: 0, rate_limited: 0 };
  });
}

/* ------------------------------------------------------------------ keys */

function Keys({ keys, stats, onChanged, onSecret, onError }: { keys: ApiKeyRow[]; stats: ApiStats | null; onChanged: () => Promise<void>; onSecret: (s: Secret) => void; onError: (e: string | null) => void }) {
  const [creating, setCreating] = useState(false);
  const usage = new Map((stats?.per_key ?? []).map((k) => [k.id, k]));
  return (
    <section className="gp" aria-labelledby="dash-keys-h">
      <div className="tb"><h2 id="dash-keys-h">API keys</h2><button className="btn sm gb" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>{creating ? "Close" : "New key"}</button></div>
      <div className="pad">
        {creating && <CreateKey onCreated={async (s) => { onSecret(s); setCreating(false); await onChanged(); }} onError={onError} />}
        {keys.length === 0 ? <p className="muted" style={{ margin: 0 }}>No keys yet. Press New key to make the first one (for example, for the Discord bot).</p> : (
          <div className="dash-keys">
            {keys.map((k) => <KeyCard key={k.id} k={k} replacedBy={keys.find((x) => x.id === k.replaced_by)?.label ?? null} usage={usage.get(k.id)} onChanged={onChanged} onSecret={onSecret} onError={onError} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function CreateKey({ onCreated, onError }: { onCreated: (s: Secret) => Promise<void>; onError: (e: string | null) => void }) {
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(["catalogue:read", "calculator:execute"]);
  const [catalogueRpm, setCatalogueRpm] = useState(60);
  const [calculatorRpm, setCalculatorRpm] = useState(120);
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = checkNewKey({ label, scopes, catalogueRpm, calculatorRpm, expires });
    setProblem(bad);
    if (bad) return;
    setBusy(true);
    const { data, error } = await supabase().rpc("api_admin_create_key", {
      p_label: label.trim(), p_scopes: scopes, p_expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      p_catalogue_rpm: catalogueRpm, p_calculator_rpm: calculatorRpm,
    });
    setBusy(false);
    if (error || !data) { onError("Couldn't create the key. Check the details and try again."); return; }
    onError(null);
    await onCreated({ label: label.trim(), key: (data as { key: string }).key, note: "Give it to the integration's developer privately (not in a public channel)." });
  };

  return (
    <form className="dash-form" onSubmit={submit}>
      <label className="small muted" htmlFor="key-label">Name (who or what uses it)</label>
      <input id="key-label" className="input" value={label} maxLength={60} placeholder="Discord bot (Alex)" onChange={(e) => setLabel(e.target.value)} />
      <fieldset className="dash-fieldset">
        <legend className="small muted">Permissions</legend>
        {SCOPES.map((s) => (
          <label key={s.id} className="dash-check">
            <input type="checkbox" checked={scopes.includes(s.id)} onChange={(e) => setScopes((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))} />
            <span><b>{s.name}</b> <span className="small muted">{s.text}</span></span>
          </label>
        ))}
      </fieldset>
      <div className="dash-row">
        <label className="small muted">Catalogue limit (per minute)<input className="input" type="number" min={1} max={10000} value={catalogueRpm} onChange={(e) => setCatalogueRpm(Math.floor(Number(e.target.value)))} /></label>
        <label className="small muted">Calculator limit (per minute)<input className="input" type="number" min={1} max={10000} value={calculatorRpm} onChange={(e) => setCalculatorRpm(Math.floor(Number(e.target.value)))} /></label>
        <label className="small muted">Expires (optional)<input className="input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
      </div>
      {problem && <p className="login-error small" role="alert">{problem}</p>}
      <button className="btn gb" type="submit" disabled={busy}>{busy ? "Creating…" : "Create key"}</button>
    </form>
  );
}

function KeyCard({ k, replacedBy, usage, onChanged, onSecret, onError }: {
  k: ApiKeyRow; replacedBy: string | null; usage?: ApiStats["per_key"][number];
  onChanged: () => Promise<void>; onSecret: (s: Secret) => void; onError: (e: string | null) => void;
}) {
  const status = keyStatus(k);
  const [confirm, setConfirm] = useState<"revoke" | "rotate" | null>(null);
  const [overlap, setOverlap] = useState(24);
  const [busy, setBusy] = useState(false);
  const live = status === "active" || status === "expiring";

  const revoke = async () => {
    setBusy(true);
    const { error } = await supabase().rpc("api_admin_revoke_key", { p_id: k.id });
    setBusy(false); setConfirm(null);
    if (error) { onError("Couldn't revoke the key."); return; }
    onError(null); await onChanged();
  };
  const rotate = async () => {
    setBusy(true);
    const { data, error } = await supabase().rpc("api_admin_rotate_key", { p_id: k.id, p_overlap_hours: overlap });
    setBusy(false); setConfirm(null);
    if (error || !data) { onError("Couldn't rotate the key."); return; }
    onError(null);
    onSecret({ label: k.label, key: (data as { key: string }).key, note: overlap ? `The old key keeps working for ${overlap} hours, then stops. Swap it in the bot before then.` : "The old key stopped working straight away." });
    await onChanged();
  };

  return (
    <article className={`dash-key${live ? "" : " off"}`} aria-label={k.label}>
      <div className="dash-key-h">
        <b>{k.label}</b>
        <span className={`badge ${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>
      </div>
      <code className="dash-code">{maskKey(k.prefix)}</code>
      <dl className="dash-dl">
        <dt>Permissions</dt><dd>{k.scopes.map((s) => SCOPES.find((x) => x.id === s)?.name ?? s).join(", ")}</dd>
        <dt>Limits</dt><dd>{k.catalogue_rpm}/min catalogue · {k.calculator_rpm}/min calculator</dd>
        <dt>Created</dt><dd>{new Date(k.created_at).toLocaleDateString("en-GB")}</dd>
        <dt>Last used</dt><dd>{ago(k.last_used_at)}</dd>
        <dt>Last 7 days</dt><dd>{usage ? `${fmt(usage.requests_7d, 0)} request${usage.requests_7d === 1 ? "" : "s"}, ${fmt(usage.failed_7d, 0)} failed` : "–"}</dd>
        {k.expires_at && <><dt>{status === "expired" ? "Expired" : "Expires"}</dt><dd>{new Date(k.expires_at).toLocaleString("en-GB")}</dd></>}
        {k.revoked_at && <><dt>Revoked</dt><dd>{new Date(k.revoked_at).toLocaleString("en-GB")}</dd></>}
        {replacedBy && <><dt>Replaced by</dt><dd>{replacedBy} (new key)</dd></>}
      </dl>
      {live && (
        <div className="dash-actions">
          {confirm === null && <>
            <button className="btn sm" onClick={() => setConfirm("rotate")} disabled={busy}>Rotate</button>
            <button className="btn sm danger-btn" onClick={() => setConfirm("revoke")} disabled={busy}>Revoke</button>
          </>}
          {confirm === "revoke" && <>
            <span className="small">Revoke {k.label}? Requests with it fail from now on. This can&apos;t be undone.</span>
            <button className="btn sm danger-btn confirm" onClick={() => void revoke()} disabled={busy}>Yes, revoke</button>
            <button className="btn sm" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
          </>}
          {confirm === "rotate" && <>
            <label className="small">Old key keeps working for{" "}
              <select className="input dash-select" value={overlap} onChange={(e) => setOverlap(Number(e.target.value))}>
                <option value={0}>0 hours (stop now)</option><option value={1}>1 hour</option><option value={24}>24 hours</option><option value={72}>3 days</option><option value={168}>7 days</option>
              </select>
            </label>
            <button className="btn sm gb" onClick={() => void rotate()} disabled={busy}>Make new key</button>
            <button className="btn sm" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
          </>}
        </div>
      )}
    </article>
  );
}

/** The new key, shown once. */
function SecretBox({ secret, onDone }: { secret: Secret; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(secret.key); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <section className="gp dash-secret" role="alert" aria-labelledby="dash-secret-h">
      <div className="tb"><h2 id="dash-secret-h">New key for {secret.label}</h2></div>
      <div className="pad">
        <p style={{ marginTop: 0 }}><b>Copy it now.</b> This is the only time it&apos;s shown: only a fingerprint of it is stored, so nobody (including you) can see it again.</p>
        <div className="dash-secret-row">
          <code className="dash-code" aria-label="API key">{secret.key}</code>
          <button className="btn sm gb" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <p className="small muted">{secret.note} It goes in the bot&apos;s environment variables (for example FORGE_API_KEY), never in code or a public repository.</p>
        <button className="btn sm" onClick={onDone}>I&apos;ve saved it, hide the key</button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ settings and activity */

function Settings({ value, onSaved, onError }: { value: { on: boolean; rpm: number }; onSaved: () => Promise<void>; onError: (e: string | null) => void }) {
  const [rpm, setRpm] = useState(value.rpm);
  const [busy, setBusy] = useState(false);
  const save = async (on: boolean) => {
    if (!Number.isInteger(rpm) || rpm < 1 || rpm > 10000) { onError("The limit must be a whole number from 1 to 10,000."); return; }
    setBusy(true);
    const { error } = await supabase().rpc("api_admin_set_settings", { p_anonymous_catalogue: on, p_anonymous_catalogue_rpm: rpm });
    setBusy(false);
    if (error) { onError("Couldn't save the setting."); return; }
    onError(null); await onSaved();
  };
  return (
    <section className="gp" aria-labelledby="dash-set-h">
      <div className="tb"><h2 id="dash-set-h">Access</h2></div>
      <div className="pad">
        <div className="setting-row">
          <div>
            <div className="strong" id="anon-label" style={{ fontWeight: 700 }}>Catalogue without a key</div>
            <p className="small muted" id="anon-desc" style={{ margin: "2px 0 0" }}>Off during the beta: every request needs a key. On: anyone can read the catalogue, limited per IP address. The calculator always needs a key.</p>
            <label className="small muted">Limit per IP (per minute) <input className="input dash-num" type="number" min={1} max={10000} value={rpm} onChange={(e) => setRpm(Math.floor(Number(e.target.value)))} /></label>
          </div>
          <button className="switch" role="switch" aria-checked={value.on} aria-labelledby="anon-label" aria-describedby="anon-desc" disabled={busy} onClick={() => void save(!value.on)}>
            <span className="switch-knob" aria-hidden="true" />
            <span className="switch-text" aria-hidden="true">{value.on ? "On" : "Off"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function Activity({ stats }: { stats: ApiStats }) {
  return (
    <section className="gp" aria-labelledby="dash-act-h">
      <div className="tb"><h2 id="dash-act-h">Recent requests</h2><span className="small muted">last 50</span></div>
      <div className="pad">
        {stats.errors_7d.length > 0 && <p className="small" style={{ marginTop: 0 }}><b>Errors in the last 7 days:</b> {stats.errors_7d.map((e) => `${e.code} × ${e.count}`).join(" · ")}</p>}
        {stats.recent.length === 0 ? <p className="muted" style={{ margin: 0 }}>No requests yet.</p> : (
          <div className="scroll-x">
            <table className="table dash-table">
              <thead><tr><th>Time</th><th>Endpoint</th><th>Key</th><th>Status</th><th style={{ textAlign: "right" }}>Time taken</th><th>Error</th></tr></thead>
              <tbody>
                {stats.recent.map((r, i) => (
                  <tr key={i}>
                    <td title={new Date(r.at).toLocaleString("en-GB")}>{ago(r.at)}</td>
                    <td>{r.endpoint}</td>
                    <td>{r.key_label ?? <span className="muted">none</span>}</td>
                    <td><span className={r.status != null && r.status >= 400 ? "dash-bad" : ""}>{r.status ?? "…"}</span></td>
                    <td className="num">{r.latency_ms != null ? `${r.latency_ms} ms` : "–"}</td>
                    <td className="small">{r.error_code ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small faint" style={{ margin: "8px 0 0" }}>The log keeps 30 days and stores no keys, request bodies or IP addresses.</p>
      </div>
    </section>
  );
}
