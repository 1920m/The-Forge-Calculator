import Link from "next/link";
import { Anvil } from "./icons";
import { DATA_DATE } from "@/lib/data/supabase";

export function Footer() {
  return (
    <footer className="footer">
      <div className="gp">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "36px 64px", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 340 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="tile" style={{ width: 44, height: 44, borderWidth: 1, borderColor: "#4a4850" }}><Anvil size={26} /></span>
              <span className="shine" style={{ fontSize: 28 }}>Forge Calculator</span>
            </div>
            <p style={{ margin: "14px 0 0", color: "#8d8c92", fontSize: 18 }}>Plan every craft before you smelt it.<br />Free. No login. Built for The Forge.</p>
          </div>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: "28px 64px" }} aria-label="Footer">
            <div><div className="footer-h">Calculator</div>
              <div className="fl"><Link href="/armour">Armour</Link><Link href="/weapons">Weapons</Link><Link href="/ores">Ores</Link><Link href="/how-it-works">How it works</Link></div></div>
            <div><div className="footer-h">Game data</div>
              <div className="fl"><Link href="/ores">Ore traits</Link><Link href="/how-it-works#odds">Forge odds</Link><Link href="/how-it-works#enhancement">Enhancement</Link></div></div>
            <div><div className="footer-h">Community</div>
              <div className="fl"><a href="https://www.roblox.com/discover?Keyword=The%20Forge" target="_blank" rel="noopener noreferrer">Roblox game page</a><a href="https://forgewiki.org/wiki/Ores" target="_blank" rel="noopener noreferrer">Forge Wiki</a><a href="https://github.com/1920m/Forge-Calculator/issues" target="_blank" rel="noopener noreferrer">Report a mistake</a></div></div>
          </nav>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px", alignItems: "center", marginTop: 30, fontSize: 15, color: "#8d8c92" }}>
          <span>Data as of {DATA_DATE}. Fan-made tool, not affiliated with the game&apos;s developers or Roblox. Game data from the community wiki (CC BY-SA).</span>
          <span style={{ border: "1px dashed #4a4850", padding: "2px 12px" }}>Official partner badge: reserved</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <span className="badge ok">Confirmed in game</span><span className="badge der">Derived</span><span className="badge unv">Unverified</span>
        </div>
        <div className="dotword" aria-hidden="true">FORGE</div>
      </div>
    </footer>
  );
}
