import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "kick-ai — kicker Interactive Decision-Support",
  description: "Effizienz-Anker & Spieltags-Optimierer. kaivo.studio",
};

function Nav() {
  const items = [
    { href: "/", label: "Übersicht" },
    { href: "/matchday", label: "Spieltag" },
    { href: "/squad", label: "Kader" },
  ];
  return (
    <header className="border-b border-ink-line bg-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-bold tracking-tight">kick-ai</span>
          <span className="h-2 w-2 rounded-full bg-signal" />
        </Link>
        <nav className="flex gap-1">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="rounded-md px-3 py-1.5 text-sm text-ink-muted hover:bg-canvas hover:text-ink"
            >
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <Nav />
        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-5 py-8">
          <p className="label-caps">
            kaivo.studio · Decision-Support, kein Bot · Aufstellung bestätigt Kai selbst
          </p>
        </footer>
      </body>
    </html>
  );
}
