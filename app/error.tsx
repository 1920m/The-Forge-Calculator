"use client";

/** Shown instead of a blank page if anything fails while rendering. Lets the player reset saved data and retry. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const startFresh = () => {
    try { for (const k of ["forge.recipe", "forge.kind", "forge.quality"]) window.localStorage.removeItem(k); } catch { /* storage unavailable */ }
    window.location.replace(window.location.pathname);
  };
  return (
    <div className="page">
      <section className="gp" style={{ maxWidth: 560, margin: "40px auto" }}>
        <div className="tb"><h1 className="title">Something went wrong</h1></div>
        <div className="pad">
          <p style={{ marginTop: 0, color: "#cfc7b2" }}>This page hit an error. A broken share link or saved recipe is the usual cause.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => reset()}>Try again</button>
            <button className="btn" onClick={startFresh}>Start with an empty forge</button>
          </div>
        </div>
      </section>
    </div>
  );
}
