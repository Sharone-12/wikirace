import type { Metadata, Viewport } from "next";
import { Archivo, Oswald, Source_Serif_4, Yellowtail } from "next/font/google";
import { SiteFooter } from "@/components/Doodles";
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
      className={`${display.variable} ${condensed.variable} ${script.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="site">
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
