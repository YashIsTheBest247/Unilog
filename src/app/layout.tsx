import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { THEME_INIT } from "@/components/site/ThemeToggle";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const DESCRIPTION =
  "Taxonomy-driven product enrichment with adversarial validation and attribute-level provenance. Every published value cites the exact span of the source it came from.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Unilog · Product Intelligence Engine",
    template: "%s · Unilog Product Intelligence",
  },
  description: DESCRIPTION,
  applicationName: "Unilog Product Intelligence",
  keywords: [
    "PIM",
    "product data enrichment",
    "industrial commerce",
    "product taxonomy",
    "data validation",
    "PVF",
  ],
  openGraph: {
    type: "website",
    title: "Unilog · Product Intelligence Engine",
    description: DESCRIPTION,
    siteName: "Unilog Product Intelligence",
  },
  twitter: {
    card: "summary_large_image",
    title: "Unilog · Product Intelligence Engine",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f4" },
    { media: "(prefers-color-scheme: dark)", color: "#08080a" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${jetbrains.variable}`}
    >
      <head>
        {/* Runs before first paint so the page never flashes the wrong
            theme on load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="focus-ring sr-only rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-[var(--on-accent)] focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100]"
        >
          Skip to content
        </a>

        <div className="relative flex min-h-dvh flex-col">
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
