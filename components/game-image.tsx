"use client";

import { useState } from "react";
import { Anvil } from "./icons";

const failed = new Set<string>();

/** Loads a game image from Supabase Storage; shows the striped placeholder tile while missing or loading. */
export function GameImage({ src, alt, size = 28 }: { src: string | null; alt: string; size?: number }) {
  const [broken, setBroken] = useState(() => !src || failed.has(src));
  if (!src || broken) return <span className="glyph"><Anvil size={size} color="#6a665c" /></span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => { failed.add(src); setBroken(true); }} />
  );
}
