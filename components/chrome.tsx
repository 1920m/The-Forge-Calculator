"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoadBar, WorldSwitch } from "./shell";
import { Anvil } from "./icons";
import { AccountMenu } from "./account-menu";

const NAV = [
  ["/", "Calculator"],
  ["/ores", "Ores"],
  ["/weapons", "Weapons"],
  ["/armour", "Armour"],
  ["/builds", "Builds"],
  ["/how-it-works", "How it works"],
] as const;

export function Header() {
  const path = usePathname();
  return (
    <>
      <header className="header">
        <Link href="/" className="brand" aria-label="Forge Calculator home">
          <span className="brand-mark tile" style={{ borderWidth: 1, borderColor: "#4a4850" }}><Anvil size={22} /></span>
          <span className="shine" style={{ fontSize: 20 }}>Forge Calculator</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        <WorldSwitch />
        <AccountMenu />
      </header>
      <LoadBar />
    </>
  );
}
