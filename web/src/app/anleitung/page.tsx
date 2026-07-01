import Link from "next/link";

export const metadata = { title: "Anleitung — kick-ai" };

function Step({
  n,
  title,
  children,
}: {
  n: number | string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-signal font-mono text-sm font-semibold text-signal">
        {n}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <h3 className="font-medium">{title}</h3>
        <div className="mt-1 space-y-1 text-sm leading-relaxed text-ink-muted">
          {children}
        </div>
      </div>
    </div>
  );
}

function Phase({
  tag,
  title,
  cadence,
  children,
}: {
  tag: string;
  title: string;
  cadence: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="label-caps">{tag}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <span className="chip bg-signal-50 text-signal-700">{cadence}</span>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function AnleitungPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">So funktioniert&apos;s</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Von der Kaderauswahl zur Spieltagsentscheidung
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Der Prozess hat zwei Phasen: den <strong className="text-ink">Kader</strong>{" "}
          stellst du einmal auf (und passt ihn nur bei Transfers an) — die{" "}
          <strong className="text-ink">Aufstellung</strong> entscheidest du jeden
          Spieltag neu. Der zweite Teil ist der eigentliche Hebel.
        </p>
      </div>

      <Phase tag="Phase 1 · Grundlage" title="Kader aufstellen" cadence="einmalig / bei Transfers">
        <Step n={1} title="Spieler zusammenstellen">
          <p>
            Auf <Link href="/squad" className="text-signal hover:underline">Kader</Link>{" "}
            suchst du Spieler aus dem echten Bundesliga-Pool und fügst sie hinzu.
            Verein, Position, Marktwert und erwartete Punkte werden automatisch gefüllt.
          </p>
        </Step>
        <Step n={2} title="Auf Effizienz-Anker setzen">
          <p>
            Leitidee: billige, gesetzte Dauerläufer (oft ABW/MF) bringen pro Euro
            mehr als teure Stars. Warum, steht in der{" "}
            <Link href="/methodik" className="text-signal hover:underline">Methodik</Link>.
          </p>
        </Step>
        <Step n={3} title="Budget & Struktur einhalten">
          <p>
            22 Spieler (3 TW, 7 ABW, 7 MF, 5 ST), max. 42,5 Mio. Der Editor prüft
            das live und zeigt „gültiger Kader", sobald alles passt. Änderungen werden
            automatisch gespeichert.
          </p>
        </Step>
      </Phase>

      <Phase tag="Phase 2 · Wochenbetrieb" title="Jeden Spieltag entscheiden" cadence="vor jedem Spieltag">
        <Step n={1} title="Spieltag wählen">
          <p>
            Auf <Link href="/matchday" className="text-signal hover:underline">Spieltag</Link>{" "}
            den anstehenden Spieltag wählen. Der Spielplan (Gegner, Anstoßzeiten)
            wird live von OpenLigaDB geladen.
          </p>
        </Step>
        <Step n={2} title="News recherchieren lassen (KI)">
          <p>
            Im Panel „News automatisch durchsuchen" auf <strong className="text-ink">News
            durchsuchen</strong> klicken: Die KI sucht auf festen Quellen (kicker,
            ligainsider, transfermarkt …) die voraussichtlichen Aufstellungen und
            Verletzungsnews — nur zu deinen Kadervereinen — und schlägt pro Spieler
            einen Status vor. Du übernimmst einzeln oder alle.
          </p>
        </Step>
        <Step n={3} title="Status prüfen & anpassen">
          <p>
            Pro Spieler den Status setzen: <strong className="text-ink">start</strong> ·{" "}
            <strong className="text-ink">fraglich</strong> ·{" "}
            <strong className="text-ink">Bank</strong> ·{" "}
            <strong className="text-ink">raus</strong>. Wessen Verein nicht spielt, ist
            automatisch „raus". Die KI-Vorschläge sind ein Startpunkt — die letzte
            Einschätzung triffst du.
          </p>
        </Step>
        <Step n={4} title="Empfohlene Elf ansehen">
          <p>
            Rechts erscheint sofort die optimale Formation + Startelf mit erwartetem
            Punktwert und Warnungen (z.B. fragliche Spieler in der Elf). Sie aktualisiert
            sich mit jeder Status-Änderung.
          </p>
        </Step>
        <Step n={5} title="Deadline-Timeline nutzen">
          <p>
            Die Timeline zeigt, bis wann du welche Entscheidung fixieren musst —
            sortiert nach Anstoß. Du kannst pro Spieler bis zum Anpfiff seines Spiels
            noch tauschen.
          </p>
        </Step>
        <Step n={6} title="Im kicker selbst aufstellen">
          <p>
            Die App <strong className="text-ink">empfiehlt</strong> — du trägst die Elf
            im echten kicker-Managerspiel selbst ein. Decision-Support, kein Bot
            (AGB-konform).
          </p>
        </Step>
      </Phase>

      <div className="card border-signal bg-signal-50 p-5">
        <p className="label-caps text-signal-700">Der eigentliche Hebel</p>
        <p className="mt-1 text-sm leading-relaxed">
          Der größte, robusteste Gewinn kommt aus <strong>Disziplin</strong>: jeden
          Spieltag nur Spieler aufstellen, die auch wirklich spielen. Genau dafür ist
          Phase 2 da. Ein teurer Star auf der Bank bringt 0 Punkte — ein gesetzter
          Anker liefert. Nutze das Anpfiff-Fenster: Bis zum Start jedes Spiels kannst
          du noch reagieren.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="label-caps">Was die App automatisch macht</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Spielplan & Anstoßzeiten live von OpenLigaDB</li>
            <li>Spieler ohne Spiel → automatisch „raus"</li>
            <li>Status wird gespeichert; neuer Spieltag erbt den der Vorwoche</li>
            <li>Formation & Elf werden bei jeder Änderung neu berechnet</li>
          </ul>
        </div>
        <div className="card p-5">
          <p className="label-caps">Grenzen</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Kein Auto-Aufstellen im kicker — du bestätigst selbst</li>
            <li>KI-Statusvorschläge sind Vorschläge, keine Gewissheit</li>
            <li>Keine Zukunfts-Vorhersage — die App rechnet mit deinen Angaben</li>
          </ul>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/squad" className="btn-ghost">Zum Kader</Link>
        <Link href="/matchday" className="btn-signal">Spieltag optimieren</Link>
      </div>
    </div>
  );
}
