import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue } from "@/lib/data/catalogue";
import { ERRORS } from "@/lib/api/errors";
import { CHANGELOG, EXAMPLES, WARNINGS, exampleCatalogue, exampleResponse, shorten, type ExampleType } from "@/lib/api/docs";
import { CATALOGUE_TYPES } from "@/lib/api/schema";
import { API_VERSION, MODEL_VERSION } from "@/lib/api/version";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Developer API",
  description: "The Forge Calculator API: game data and forge, DPS, loadout and Golemite calculations for Discord bots and other tools.",
};

const BASE = `${SITE_URL}/api/v1`;
const json = (v: unknown) => JSON.stringify(v, null, 2);

/** An error or warning code that can break after its underscores on a phone. */
const CodeName = ({ name }: { name: string }) => <code className="api-name">{name.split("_").map((p, i) => <span key={i}>{i ? <>_<wbr /></> : null}{p}</span>)}</code>;

/** Text with `backticks` shown as code. */
const Md = ({ text }: { text: string }) => <>{text.split("`").map((p, i) => (i % 2 ? <code key={i}>{p}</code> : p))}</>;

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="api-code">
      {label && <div className="api-code-label">{label}</div>}
      <pre tabIndex={0}><code>{children}</code></pre>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="gp api-section" id={id} aria-labelledby={`${id}-h`}>
      <div className="tb"><h2 id={`${id}-h`}>{title}</h2></div>
      <div className="pad api-body">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="api-table-wrap" tabIndex={0}>
      <table className="api-table">
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const MODES: { type: ExampleType; title: string; what: React.ReactNode }[] = [
  { type: "forge", title: "forge: what a recipe makes", what: <>Send <code>kind</code> (<code>weapon</code> or <code>armour</code>), up to four ores with counts, and usually the <code>item</code> you&apos;re aiming for. You get the multiplier, rarity, the item&apos;s damage or defence at that quality, its chance (overall and inside its class), the class lock, active traits and, for weapons, attack speed and estimated DPS at +0. Optional: <code>world</code>, <code>quality</code> (1–100, default 100), <code>lockClass</code>, <code>molds</code>, <code>enhancement</code> (0–9), weapon <code>runes</code>, and <code>detail: &quot;full&quot;</code> for every class and item with its chances.</> },
  { type: "dps", title: "dps: one weapon in depth", what: <>A weapon with enhancement, runes, armour ore mixes and a race. Returns total DPS split into hits and procs, each proc, crit and attack-speed figures, a layer-by-layer breakdown, and situational <code>scenarios</code> kept out of the main number.</> },
  { type: "loadout", title: "loadout: weapon and armour together", what: <>Up to four pieces (<code>weapon</code>, <code>helmet</code>, <code>chestplate</code>, <code>leggings</code>), each an item and its ores, plus enhancement, runes and race. Returns each piece, total defence and the loadout DPS, like the Loadout page on the site.</> },
  { type: "golemite", title: "golemite: Golem companions", what: <>10 to 50 ores (up to four types), Worlds 3 and 4. Returns the in-game name, rarity, mining help, ore-trait share, size and growth by level, and storage. How Golemites fight isn&apos;t known, so <code>combat.damage</code> is always <code>null</code>.</> },
];

export default async function Page() {
  const cat = await getCatalogue();
  const errorRows = Object.entries(ERRORS).sort((a, b) => a[1].status - b[1].status);

  return (
    <div className="page api-doc">
      <header className="api-hero">
        <p className="api-kicker">Developers · {API_VERSION} beta</p>
        <h1 className="title" style={{ fontSize: 28 }}>Forge Calculator API</h1>
        <p>The same game data and maths as this site, as JSON, for Discord bots and other fan tools. Two endpoints: one for the catalogue, one for calculations.</p>
        <Code label="Base URL">{BASE}</Code>
        <p className="api-links">
          <a className="inline-link" href="/developers/openapi.json">OpenAPI spec</a>
          <a className="inline-link" href="#discord">Discord bot guide</a>
          <a className="inline-link" href="#errors">Error codes</a>
        </p>
      </header>

      <nav className="api-toc" aria-label="On this page">
        {[["access", "Getting a key"], ["auth", "Authentication"], ["responses", "Responses"], ["limits", "Rate limits"], ["catalogue", "GET /catalogue"], ["calculate", "POST /calculate"], ["worlds", "Worlds"], ["errors", "Errors"], ["warnings", "Warnings"], ["discord", "Discord bots"], ["changelog", "Changelog"]].map(([id, label]) => (
          <a key={id} href={`#${id}`}>{label}</a>
        ))}
      </nav>

      <Section id="access" title="Getting a key">
        <p>The API is in a private beta: every request needs a key, including the catalogue. Keys are given out by the site&apos;s admin. Ask through the Feedback button at the bottom of any page, and say what you&apos;ll use it for.</p>
        <p>You&apos;ll get a key that starts with <code>fc_live_</code>. It&apos;s shown to the admin once and can&apos;t be looked up again, so keep it somewhere safe. If it leaks, ask for it to be rotated: you get a new key, and the old one keeps working for a short overlap so your bot doesn&apos;t go down.</p>
      </Section>

      <Section id="auth" title="Authentication">
        <p>Send the key in the <code>Authorization</code> header on every request:</p>
        <Code>{`Authorization: Bearer fc_live_...`}</Code>
        <p>Keep the key on your server or bot. Never put it in a web page, a mobile app or a public repository: anyone who has it can use your rate limit. Each key has permissions: <code>catalogue:read</code> for the catalogue and <code>calculator:execute</code> for calculations.</p>
      </Section>

      <Section id="responses" title="Responses">
        <p>Every successful response has the same envelope. Use <code>data</code>; the rest helps you cache and report problems.</p>
        <Table head={["Field", "Meaning"]} rows={[
          [<code key="a">success</code>, "true"],
          [<code key="a">apiVersion</code>, `"${API_VERSION}". Breaking changes would get a new version.`],
          [<code key="a">catalogueRevision</code>, "The game-data release the answer used. It goes up when ores, weapons or odds are updated."],
          [<code key="a">dataVersion</code>, "A short hash of the data shipped with the site (races, runes, molds, Golemites)."],
          [<code key="a">calculationModelVersion</code>, `On /calculate: the date of the maths the site uses (now ${MODEL_VERSION}).`],
          [<code key="a">requestId</code>, "Quote it when you report a problem. Also in the X-Request-Id header."],
          [<code key="a">data</code>, "The answer."],
          [<code key="a">warnings</code>, <>On /calculate: things to know about the result (<a className="inline-link" href="#warnings">list</a>).</>],
        ]} />
        <p>Errors look like this, with a stable <code>code</code> to branch on and a <code>message</code> you can show to people:</p>
        <Code>{json({ success: false, apiVersion: API_VERSION, error: { code: "INVALID_ORE", message: "Unknown ore ID: nope.", requestId: "req_example" } })}</Code>
        <p>Values the game data doesn&apos;t have (an unknown drop chance, a Golemite&apos;s damage) are <code>null</code>, never guessed.</p>
      </Section>

      <Section id="limits" title="Rate limits">
        <p>Limits are per key, per minute, and shared by all of the site&apos;s servers. The defaults are below; the admin can change them per key.</p>
        <Table head={["Endpoint", "Default limit"]} rows={[["GET /catalogue", "60 a minute"], ["POST /calculate", "120 a minute"]]} />
        <p>Every response tells you where you are:</p>
        <Table head={["Header", "Meaning"]} rows={[
          [<code key="a">X-RateLimit-Limit</code>, "Requests allowed this minute."],
          [<code key="a">X-RateLimit-Remaining</code>, "How many are left."],
          [<code key="a">X-RateLimit-Reset</code>, "Seconds until the minute starts again."],
          [<code key="a">Retry-After</code>, "On a 429: seconds to wait."],
        ]} />
        <p>Over the limit you get <code>429 RATE_LIMITED</code>. An address that sends 20 wrong keys in 10 minutes is blocked for 10 minutes (<code>TOO_MANY_INVALID_KEYS</code>). Cache the catalogue (below) and you&apos;ll rarely get near the limits.</p>
      </Section>

      <Section id="catalogue" title="GET /catalogue">
        <p>Game data: {CATALOGUE_TYPES.join(", ")}. Without filters you get every section. It changes only when the game data is updated, so fetch it once and keep it.</p>
        <Table head={["Query", "What it does"]} rows={[
          [<code key="a">type</code>, <>One section: {CATALOGUE_TYPES.map((t, i) => <span key={t}>{i ? ", " : ""}<code>{t}</code></span>)}.</>],
          [<code key="a">world</code>, "1–4: only what that world's forge or mines have. Worlds 1 and 2 share a forge."],
          [<code key="a">ids</code>, "Comma-separated catalogue IDs, up to 100."],
          [<code key="a">search</code>, "Names containing this text (case doesn't matter)."],
        ]} />
        <p>Each response has an <code>ETag</code>. Send it back as <code>If-None-Match</code>; if nothing changed you get an empty <code>304</code>, which is quick and still counts as one request.</p>
        <Code label="Request">{`curl "${BASE}/catalogue?type=ores&ids=bismuth" \\
  -H "Authorization: Bearer $FORGE_API_KEY"`}</Code>
        <details className="api-details"><summary>Example response</summary><Code>{json(exampleCatalogue(cat))}</Code></details>
        <p>Ores have <code>multiplier: null</code> and <code>multiplierRule: &quot;average&quot;</code> when they take the average of the other ores (like Bismuth). <code>traits[].appliesTo</code> says whether a trait works on weapons, armour or both, and <code>traitRule</code> how strength grows with the ore&apos;s share. IDs are stable; names can change, so store IDs.</p>
      </Section>

      <Section id="calculate" title="POST /calculate">
        <p>One endpoint with four kinds of calculation, picked by <code>type</code>. Send JSON (<code>Content-Type: application/json</code>, at most 16 KB). Everything uses catalogue IDs. Each ore can appear once; add the counts together. The numbers match the calculator on this site.</p>
        <Code label="Request">{`curl -X POST "${BASE}/calculate" \\
  -H "Authorization: Bearer $FORGE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(EXAMPLES.forge)}'`}</Code>
        {MODES.map((m) => (
          <div key={m.type} className="api-mode" id={`calculate-${m.type}`}>
            <h3>{m.title}</h3>
            <p>{m.what}</p>
            <Code label="Request body">{json(EXAMPLES[m.type])}</Code>
            <details className="api-details"><summary>Example response (long lists cut to their first items)</summary><Code>{json(shorten(exampleResponse(cat, m.type)))}</Code></details>
          </div>
        ))}
        <p>Every forge result has <code>links.calculator</code>: the same recipe opened on this site. Put it on your embeds so people can explore further.</p>
      </Section>

      <Section id="worlds" title="Worlds">
        <p>Each world&apos;s forge has its own items and odds; Worlds 1 and 2 share one (shown as <code>1–2</code>). You usually don&apos;t need to send <code>world</code>:</p>
        <ol>
          <li>If the item can only be forged in one world, that world is used.</li>
          <li>If it can be forged in several, the world where all your ores are found is used (with a <code>WORLD_FROM_ORES</code> warning).</li>
          <li>If that still doesn&apos;t settle it, you get <code>422 WORLD_REQUIRED</code> with the choices in <code>details</code>. Ask your user, then send the same request with <code>world</code>. The API never guesses.</li>
        </ol>
        <Code>{json({ success: false, apiVersion: API_VERSION, error: { code: "WORLD_REQUIRED", message: ERRORS.WORLD_REQUIRED.message, requestId: "req_example", details: { worlds: [2, 3], labels: ["1–2", "3"] } } })}</Code>
      </Section>

      <Section id="errors" title="Errors">
        <Table head={["Status", "Code", "Meaning"]} rows={errorRows.map(([code, e]) => [String(e.status), <CodeName key="c" name={code} />, <Md key="m" text={e.message} />])} />
        <p><code>VALIDATION_ERROR</code> lists each problem in <code>details</code> with the field&apos;s path. Retry <code>429</code> after <code>Retry-After</code>, and <code>500</code> or <code>503</code> after a short wait; the others won&apos;t change if you send the same request again.</p>
      </Section>

      <Section id="warnings" title="Warnings">
        <p>A result can carry warnings: the answer is right, but there&apos;s something to know. Show them if you have room (a footer line is enough).</p>
        <Table head={["Code", "When"]} rows={Object.entries(WARNINGS).map(([code, text]) => [<CodeName key="c" name={code} />, <Md key="m" text={text} />])} />
      </Section>

      <Section id="discord" title="Discord bots">
        <p>Ready-made examples for a <code>/forge-calc</code> command with two subcommands:</p>
        <ul>
          <li><code>/forge-calc catalogue ore:</code> an ore&apos;s rarity, multiplier, worlds, drop chance, where it&apos;s found and its weapon and armour traits.</li>
          <li><code>/forge-calc calculator</code> with weapon or armour, the item, and up to four ores with amounts. The answer shows the item, materials, multiplier, rarity, damage or defence, attack speed and estimated DPS (weapons), chance, lock and traits, with buttons for 25, 50, 75, 90 and 100% quality. Only the person who ran the command can press them.</li>
        </ul>
        <Table head={["File", "What it is"]} rows={[
          [<a key="a" className="inline-link" href="/developers/examples/forge-api.ts" download>forge-api.ts</a>, "TypeScript client: catalogue cache with ETag, retries, typed errors, autocomplete helper."],
          [<a key="a" className="inline-link" href="/developers/examples/discord-bot.ts" download>discord-bot.ts</a>, "discord.js v14 command, embeds and buttons. Add to your bot or run it on its own."],
          [<a key="a" className="inline-link" href="/developers/examples/forge_api.py" download>forge_api.py</a>, "Python client (standard library only)."],
          [<a key="a" className="inline-link" href="/developers/examples/discord_bot.py" download>discord_bot.py</a>, "discord.py 2 version of the same command."],
        ]} />
        <p>Tips that keep a bot quick and inside Discord&apos;s limits:</p>
        <ul>
          <li><b>Autocomplete from the cache.</b> Discord gives autocomplete 3 seconds and 25 choices. Fetch the catalogue once, then filter in memory; the clients re-check it with ETag every 10 minutes.</li>
          <li><b>Defer, then edit.</b> Call <code>deferReply</code> before the API call and <code>editReply</code> with the result.</li>
          <li><b>Remember the world.</b> After the first result, keep the <code>world</code> from <code>data.world</code> with the recipe, so quality buttons recalculate the exact same thing.</li>
          <li><b>Show the API&apos;s messages.</b> For <code>422</code> errors, <code>message</code> is written for players (&quot;A forge needs at least 3 ores.&quot;).</li>
          <li><b>Call DPS an estimate.</b> It comes from the community damage model, not from the game.</li>
        </ul>
      </Section>

      <Section id="changelog" title="Changelog">
        {CHANGELOG.map((c) => (
          <div key={c.version}><h3>{c.version} · {c.date}</h3><ul>{c.notes.map((n) => <li key={n}>{n}</li>)}</ul></div>
        ))}
        <p className="note">The machine-readable description is the <a className="inline-link" href="/developers/openapi.json">OpenAPI 3.1 spec</a>, built from the same checks the server runs. How the numbers are worked out: <Link className="inline-link" href="/how-it-works">How it works</Link>.</p>
      </Section>
    </div>
  );
}
