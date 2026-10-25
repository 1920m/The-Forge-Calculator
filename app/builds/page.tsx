import type { Metadata } from "next";
import { BuildsPage } from "@/components/builds-page";
import { getCatalogue } from "@/lib/data/catalogue";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Builds", description: "Recommended weapon and armour ore mixes for each world and stage of The Forge, with the multiplier, class odds and stats worked out." };
export default async function Page() { return <BuildsPage cat={await getCatalogue()} />; }
