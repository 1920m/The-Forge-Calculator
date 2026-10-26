import type { Metadata } from "next";
import { ItemsPage } from "@/components/items-page";
import { getCatalogue } from "@/lib/data/catalogue";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Weapons and armour", description: "Every weapon and armour class and variant in The Forge, with unlock thresholds, chances and stats." };
export default async function Page() { const catalogue = await getCatalogue(); return <ItemsPage cat={catalogue} />; }
