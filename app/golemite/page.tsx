import { redirect } from "next/navigation";

/** The Golemite forge is now part of the calculator; old links open it there with the same ores. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const o = (await searchParams).o;
  const ores = typeof o === "string" && /^[a-z0-9:,-]{1,2000}$/.test(o) ? o : null;
  redirect(ores ? `/?k=golemite&world=4&o=${encodeURIComponent(ores)}` : "/?k=golemite&world=4");
}
