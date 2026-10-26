import type { Metadata } from "next";
import { RacesPage } from "@/components/races-page";

export const metadata: Metadata = { title: "Race spins", description: "Race spin calculator for The Forge: your chance to get any race with the spins you have, the average spins needed, and every race's traits." };
export default function Page() { return <RacesPage />; }
