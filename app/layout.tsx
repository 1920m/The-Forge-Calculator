import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Shell } from "@/components/shell";
import { Header } from "@/components/chrome";
import { Footer } from "@/components/footer";
import { AuthProvider } from "@/components/auth";
import { SavedForgesProvider } from "@/components/saved-forges";
import { FeedbackProvider } from "@/components/feedback";

export const metadata: Metadata = {
  title: { default: "Forge Calculator: weapon and armour odds, stats and traits", template: "%s | Forge Calculator" },
  description: "Free calculator for the Roblox game The Forge. Pick your ores and see class and variant odds, traits, damage or defence at any quality, and every enhancement level from +0 to +10.",
};

export const viewport: Viewport = { themeColor: "#0b0a09", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SavedForgesProvider>
            <FeedbackProvider>
              <Shell>
                <a href="#main" className="sr-only">Skip to content</a>
                <Header />
                <main id="main">{children}</main>
                <Footer />
              </Shell>
            </FeedbackProvider>
          </SavedForgesProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
