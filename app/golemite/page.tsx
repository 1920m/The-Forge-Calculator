import type { Metadata } from "next";
import { GolemitePage } from "@/components/golemite-page";
import { getCatalogue } from "@/lib/data/catalogue";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Golemite forge",
  description: "Golemite calculator for The Forge: pick 10 or more ores and see your Golemite's rarity, mining help, ore traits and growth.",
};

export default async function Page() {
  return <GolemitePage cat={await getCatalogue()} />;
}
