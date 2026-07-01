import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import SiteChrome from "@/components/SiteChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "kick-ai — kicker Interactive Decision-Support",
  description: "Effizienz-Anker & Spieltags-Optimierer. kaivo.studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
