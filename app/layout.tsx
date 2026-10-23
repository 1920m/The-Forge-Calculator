import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Forge Calculator — Development preview",
  description: "A free, no-login calculator for The Forge. Currently in development.",
  robots: { index: false, follow: false }
};

export const viewport: Viewport = { themeColor: "#0b0a09", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
