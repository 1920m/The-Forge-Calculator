import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy", description: "What Forge Calculator stores about you, and how to delete it." };

const H = ({ children }: { children: React.ReactNode }) => <h2 style={{ fontSize: 20, margin: "22px 0 8px" }}>{children}</h2>;

export default function Page() {
  return (
    <div className="page">
      <article className="gp" style={{ maxWidth: 820 }}>
        <div className="tb"><h1 className="title">Privacy</h1><span className="small muted">Last updated 25 October 2026</span></div>
        <div className="pad" style={{ color: "#cfc7b2" }}>
          <p style={{ marginTop: 0 }}>Forge Calculator is a free fan project. You can use the calculator, builds and every reference page without an account. An account is only for saving forges and your loadout.</p>

          <H>Without an account</H>
          <ul>
            <li>Your current forge, world and quality are kept in your own browser (local storage) so the page remembers them. They never leave your device.</li>
            <li>We count page views and page speed with Vercel Web Analytics and Speed Insights. They use no cookies and don&apos;t identify you.</li>
          </ul>

          <H>With an account</H>
          <ul>
            <li>When you sign in with Google or Discord we receive and keep your <b>name</b>, <b>profile picture</b> and <b>email address</b>, plus an ID from that service. We use them only to sign you in and show your name and picture on the site.</li>
            <li>We keep the <b>forges you save</b> and your <b>loadout</b>. They are private: only you can see them, unless you share your profile. We also keep your settings, such as whether the DPS target panel is on.</li>
            <li><b>Sharing your profile</b> is off until you turn it on from your Forger page. It makes a link that shows your name, picture and loadout (the forges in it and your pickaxe) to anyone who has it. It never shows your email or your other saved forges, and shared pages are hidden from search engines. Choose <b>Stop sharing</b> and the link stops working straight away.</li>
            <li>A sign-in cookie keeps you signed in on this site. We don&apos;t use advertising or tracking cookies.</li>
            <li>The sign-in page loads Google&apos;s own sign-in button from accounts.google.com. Google only learns that you signed in if you choose to continue with Google.</li>
          </ul>

          <H>Feedback</H>
          <p>When you send feedback we keep your message, any images you attach, the app version and, if you leave the box ticked, the page you were on and your browser. If you&apos;re signed in, it&apos;s linked to your account. To stop spam we also keep a scrambled (hashed) form of your connection address, which can&apos;t be turned back into the address. Only the developer can read feedback.</p>

          <H>Where it&apos;s stored</H>
          <p>Accounts and saved forges are stored with Supabase in the EU (Paris). The site runs on Vercel. We don&apos;t sell or share your data, and there are no ads.</p>

          <H>Deleting your data</H>
          <p>Go to <Link href="/settings" style={{ textDecoration: "underline" }}>Settings</Link> and choose <b>Delete my account</b>. Your account, saved forges and loadout are deleted straight away. You can also remove Forge Calculator from the connected apps in your Google or Discord account.</p>

          <H>Age</H>
          <p>Google and Discord accounts are for people aged 13 or over, so signing in is too. If you&apos;re under 13, you can still use everything on the site without an account.</p>

          <H>Questions</H>
          <p>Ask on <a href="https://github.com/1920m/Forge-Calculator/issues" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>GitHub</a>. Not affiliated with the game&apos;s developers or Roblox.</p>
        </div>
      </article>
    </div>
  );
}
