import type { Metadata } from "next";
import { OresPage } from "@/components/ores-page";
import { getCatalogue } from "@/lib/data/catalogue";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Ores", description: "Every ore in The Forge with its multiplier, rarity, world and traits." };
export default async function Page() { const catalogue = await getCatalogue(); return <OresPage cat={catalogue} />; }
