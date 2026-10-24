import type { Metadata } from "next";
import { ItemsPage } from "@/components/items-page";
import { getCatalogue } from "@/lib/data/catalogue";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Weapons", description: "Every weapon class and variant in The Forge, with unlock thresholds, chances and stats." };
export default async function Page() { const catalogue = await getCatalogue(); return <ItemsPage cat={catalogue} kind="weapon" />; }
