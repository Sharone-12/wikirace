import type { Metadata, Viewport } from "next";
import { Archivo, Inter, JetBrains_Mono, Oswald, Source_Serif_4, Yellowtail } from "next/font/google";
import { SiteFooter } from "@/components/Doodles";
import { THEME_BOOT_SCRIPT } from "@/lib/client/theme";
import "./globals.css";

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
});

const condensed = Oswald({
  variable: "--font-condensed",
  subsets: ["latin"],
});

const script = Yellowtail({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

// Fonts for the code theme only, so they aren't preloaded for everyone.
const ui = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  preload: false,
});

const mono = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "WikiRace",
  description: "Race from one Wikipedia article to another using only links.",
};

export const viewport: Viewport = {
  themeColor: "#F1F0EC",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${condensed.variable} ${script.variable} ${serif.variable} ${ui.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning // the theme script sets data-theme before React hydrates
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="site">
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
