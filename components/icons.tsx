export function Anvil({ size = 24, color = "#9a9a9a" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h13a4 4 0 0 0 4-4h1M6 8v3c0 2 2 3 4 3l-2 4h8l-2-4c2 0 4-1 4-3V8" />
    </svg>
  );
}
export function Lock({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="1" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
export function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transition: "transform .4s cubic-bezier(.2,.8,.2,1)", transform: `rotate(${open ? 180 : 0}deg)` }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
