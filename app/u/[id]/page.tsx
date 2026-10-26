import type { Metadata } from "next";
import { SharedProfilePage } from "@/components/shared-profile";
import { getCatalogue } from "@/lib/data/catalogue";

export const revalidate = 3600;

// Shared profiles are for the people given the link, not search engines.
export const metadata: Metadata = { title: "Shared loadout", description: "A player's loadout on Forge Calculator.", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SharedProfilePage cat={await getCatalogue()} id={id.slice(0, 40)} />;
}
