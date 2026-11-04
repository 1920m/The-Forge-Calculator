import type { Metadata } from "next";
import { ApiDashboard } from "@/components/api-dashboard";

export const metadata: Metadata = { title: "API dashboard", robots: { index: false, follow: false } };

export default function Page() {
  return <ApiDashboard />;
}
