import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings-page";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function Page() {
  return <SettingsPage />;
}
