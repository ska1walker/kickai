import Link from "next/link";
import { SEED_SQUAD, DEFAULT_SEASON } from "@/lib/data/squad";

export default function Home() {
  const budget = Math.round(SEED_SQUAD.reduce((s, p) => s + (p.mv ?? 0), 0) * 10) / 10;
  return (
    <div className="space-y-8">
      <section>
        <p className="label-caps">kicker Managerspiel Interactive · Bundesliga</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Gewinne die Liga über <span className="text-signal">Disziplin</span>, nicht Bauchgefühl.
        </h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Zwei Hebel, aus 4 Saisons echter Daten belegt: billige{" "}
          <strong className="text-ink">Effizienz-Anker</strong> statt teurer Stars — und{" "}
          <strong className="text-ink">jeden Spieltag nur Spieler aufstellen, die spielen</strong>.
          Der Optimierer zieht den Spielplan live von OpenLigaDB.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "Korr. Marktwert↔Punkte", v: "0.70", s: "stabil über 4 Saisons" },
          { k: "Korr. Note↔Punkte", v: "≈ 0", s: "Einsatzmenge zählt, nicht Note" },
          { k: "Mikromanagement-Hebel", v: "+18%", s: "robust im 40-Saison-Backtest" },
        ].map((c) => (
          <div key={c.k} className="card p-4">
            <p className="label-caps">{c.k}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-signal">{c.v}</p>
            <p className="text-sm text-ink-muted">{c.s}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/matchday" className="card group p-5 hover:border-signal">
          <p className="label-caps">Kernwerkzeug</p>
          <h2 className="mt-1 text-lg font-semibold group-hover:text-signal">
            Spieltag optimieren →
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Status pflegen (start / fraglich / Bank / raus), empfohlene Elf + Anstoß-Deadlines.
          </p>
        </Link>
        <Link href="/squad" className="card group p-5 hover:border-signal">
          <p className="label-caps">Kader</p>
          <h2 className="mt-1 text-lg font-semibold group-hover:text-signal">
            {SEED_SQUAD.length} Spieler · {budget} Mio →
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Referenz-Saison {DEFAULT_SEASON}/{(DEFAULT_SEASON + 1) % 100}. Erwartete Punkte aus echten Daten.
          </p>
        </Link>
      </section>
    </div>
  );
}
