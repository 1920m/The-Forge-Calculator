import type { Metadata } from "next";
import { ForgerPage } from "@/components/forger-page";
import { getCatalogue } from "@/lib/data/catalogue";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Forger page", description: "Your saved forges.", robots: { index: false } };

export default async function Page() {
  return <ForgerPage cat={await getCatalogue()} />;
}
