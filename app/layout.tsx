import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Shell } from "@/components/shell";
import { Header } from "@/components/chrome";
import { Footer } from "@/components/footer";
import { AuthProvider } from "@/components/auth";
import { SavedForgesProvider } from "@/components/saved-forges";
import { FeedbackProvider } from "@/components/feedback";

const DESCRIPTION = "Free calculator for the Roblox game The Forge. Pick your ores and see class and variant odds, traits, damage or defence at any quality, and every enhancement level from +0 to +9.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "The Forge Calculator: weapon and armour odds, stats and DPS", template: "%s | Forge Calculator" },
  description: DESCRIPTION,
  applicationName: "Forge Calculator",
  keywords: ["The Forge calculator", "Forge calculator", "The Forge", "Roblox The Forge", "forge odds", "ore calculator", "weapon DPS", "race spins"],
  openGraph: { type: "website", url: SITE_URL, siteName: "Forge Calculator", title: "The Forge Calculator", description: DESCRIPTION, locale: "en_GB" },
  twitter: { card: "summary", title: "The Forge Calculator", description: DESCRIPTION },
};

/** Tells search engines what the site is (a free web app), so results can show it as one. */
const STRUCTURED = JSON.stringify({
  "@context": "https://schema.org", "@type": "WebApplication", name: "The Forge Calculator", alternateName: ["Forge Calculator", "The Forge calculator for Roblox"],
  url: SITE_URL, description: DESCRIPTION, applicationCategory: "GameApplication", operatingSystem: "Any", isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
});

export const viewport: Viewport = { themeColor: "#0b0a09", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: STRUCTURED }} />
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
