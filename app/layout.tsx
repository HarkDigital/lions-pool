import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "The Lions Pool",
  description:
    "The unconventional Detroit Lions pool: weekly slates, the points divide, and the season-long Nums.",
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
        {/* Flex column pins the footer to the viewport bottom on short pages. */}
        <body className="flex min-h-dvh flex-col">
          <div aria-hidden className="aurora-layer" />
          <RosterSync />
          <Nav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-8 sm:px-6">
            <DemoNotice />
            {children}
          </main>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
