"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Nav() {
  const items = [
    { href: "/", label: "Übersicht" },
    { href: "/matchday", label: "Spieltag" },
    { href: "/aufbau", label: "Aufbau" },
    { href: "/squad", label: "Kader" },
    { href: "/news", label: "News" },
    { href: "/anleitung", label: "Anleitung" },
    { href: "/methodik", label: "Methodik" },
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

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/login";

  if (bare) {
    return <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-5 py-8">
        <p className="label-caps">
          kaivo.studio · Decision-Support, kein Bot · Aufstellung bestätigt Kai selbst
        </p>
      </footer>
    </>
  );
}
