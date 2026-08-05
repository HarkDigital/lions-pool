import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Barlow, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DemoNotice } from "@/components/DemoNotice";
import { RosterSync } from "@/components/RosterSync";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const barlow = Barlow({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
});

const SITE_DESCRIPTION =
  "The unconventional Detroit Lions pool: weekly slates, the points divide, and the season-long Nums.";

// The share card. Every page inherits these tags, including /sign-in (where
// gated links land), so iMessage, Slack, and the rest always get the card.
// og.png is served from /public with a file extension, which the middleware
// matcher leaves public — link crawlers can fetch it without an account.
export const metadata: Metadata = {
  metadataBase: new URL("https://thelionspool.com"),
  title: "The Lions Pool",
  description: SITE_DESCRIPTION,
  applicationName: "The Lions Pool",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "The Lions Pool",
    title: "The Lions Pool",
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "The Lions Pool: This Must Be The Pool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Lions Pool",
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#070b11",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0076b6",
          colorBackground: "#0d141d",
        },
      }}
    >
      <html lang="en" className={`${bebas.variable} ${barlow.variable}`}>
        {/* Flex column pins the footer to the viewport bottom on short pages.
            svh, NOT dvh: iOS Safari resizes dvh during URL-bar collapse and a
            WebKit bug can inflate the body box mid-transition, stranding a
            viewport of dead space below the footer (the "massive footer" on
            long pages). svh is static. Footer carries mt-auto as the second
            line of defense: leftover flex space can only ever land ABOVE it. */}
        <body className="flex min-h-svh flex-col">
          <div aria-hidden className="aurora-layer" />
          <RosterSync />
          <Nav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-8 sm:px-6 sm:pb-20">
            <DemoNotice />
            {children}
          </main>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
