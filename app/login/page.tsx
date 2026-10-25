import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/components/login-page";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to save your forges and your loadout.", robots: { index: false } };

export default function Page() {
  return <Suspense><LoginPage /></Suspense>;
}
