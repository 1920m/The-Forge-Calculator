"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoadBar, WorldSwitch } from "./shell";
import { Anvil } from "./icons";
import { AccountMenu } from "./account-menu";

const NAV = [
  ["/", "Calculator"],
  ["/ores", "Ores"],
  ["/gear", "Weapons/Armour"],
  ["/races", "Races"],
  ["/builds", "Builds"],
  ["/how-it-works", "How it works"],
] as const;

/**
 * Wide screens: the page links and world switch sit in the bar. Narrower screens (tablets, phones): they fold into a
 * Menu button that opens a panel under the bar, so the bar only holds the menu, the name and the account button.
 */
export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!bar.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  return (
    <>
      <header className={`header${open ? " menu-open" : ""}`} ref={bar}>
        <button className="menu-btn" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
          <span className="burger" aria-hidden="true"><span /><span /></span>
          <span className="menu-word">{open ? "Close" : "Menu"}</span>
        </button>
        <Link href="/" className="brand" aria-label="Forge Calculator home" onClick={close}>
          <span className="brand-mark tile" style={{ borderWidth: 1, borderColor: "#4a4850" }}><Anvil size={22} /></span>
          <span className="shine brand-name" style={{ fontSize: 20 }}>Forge Calculator</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        <div className="bar-worlds"><WorldSwitch /></div>
        <AccountMenu />

        <div id="site-menu" className="menu-panel" inert={!open} aria-hidden={!open}>
          <div className="menu-inner">
            <nav className="menu-links" aria-label="Main">
              {NAV.map(([href, label], i) => (
                <Link key={href} href={href} aria-current={path === href ? "page" : undefined} onClick={close} style={{ ["--i" as string]: i }}>{label}</Link>
              ))}
            </nav>
            <div className="menu-worlds" style={{ ["--i" as string]: NAV.length }}><WorldSwitch /></div>
          </div>
        </div>
      </header>
      <LoadBar />
    </>
  );
}
