import Link from "next/link";

export const metadata = { title: "Methodik & Quellen — kick-ai" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="label-caps">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

export default function MethodikPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Transparenz</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Wonach wird empfohlen — und aus welchen Quellen?
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Diese App ist eine transparente Regel-Engine, kein Orakel. Jede
          Empfehlung ist nachvollziehbar aus den unten genannten Regeln und
          Datenquellen abgeleitet.
        </p>
      </div>

      <Card title="Wie die Elf empfohlen wird">
        <p>
          Der Spieltags-Optimierer wählt aus deinen 22 Kaderspielern Formation
          und Startelf so, dass der <strong>erwartete Punktwert</strong> maximal
          ist. Bewertet wird je Spieler:
        </p>
        <p className="font-mono text-xs text-ink-muted">
          Wert = erwartete&nbsp;Punkte × Status-Gewicht
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Erwartete Punkte</strong> = Saisonpunkte ÷ 34 Spieltage
            (aus echten Daten). Ein Dauerspieler steht so automatisch höher als
            ein selten eingesetzter — <strong>Einsatzmenge ist der Treiber</strong>.
          </li>
          <li>
            <strong>Status-Gewicht</strong> aus deiner Spieltags-Pflege:
            gesetzt&nbsp;=&nbsp;1,0 · fraglich&nbsp;=&nbsp;0,55 ·
            Bank&nbsp;=&nbsp;0,2 · raus&nbsp;=&nbsp;0. Wessen Verein an dem
            Spieltag nicht spielt, wird automatisch „raus".
          </li>
        </ul>
        <p>
          Es steckt <strong>bewusst kein ML</strong> dahinter: Der Optimierer
          rechnet nur, was du an Status vorgibst — dadurch ist jede Empfehlung
          erklärbar und du behältst die Kontrolle.
        </p>
      </Card>

      <Card title="Wonach der Kader zusammengestellt wird">
        <p>
          Leitidee aus der Datenanalyse: <strong>Effizienz-Anker</strong> —
          billige, gesetzte Dauerläufer — schlagen teure Stars pro eingesetztem
          Euro. Der Kader-Editor zeigt dir zu jedem Spieler Marktwert und
          erwartete Punkte, prüft Budget (42,5 Mio) und Struktur (3-7-7-5) live.
        </p>
        <p>
          Zwei Verfeinerungen: Der Vorschlag maximiert die{" "}
          <strong>beste aufstellbare Elf</strong> (nur 11 spielen — Budget auf ~14
          nagelfeste Starter, Rest billige Bank) und gewichtet die{" "}
          <strong>Einsatzsicherheit</strong> (war der Spieler die klare Nummer 1
          auf seiner Position im Verein?), weil Punkte von Einsatzminuten getrieben
          werden.
        </p>
        <p>Belegt aus 4 Saisons (22/23–25/26) echter kicker-Daten:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Marktwert ↔ Punkte korrelieren stabil (~0,70) — Stars blind meiden wäre falsch.</li>
          <li>Durchschnittsnote ↔ Punkte korrelieren ~0 — die Note ist kein Signal, die Einsatzmenge schon.</li>
          <li>Defensive Dauerläufer (ABW/MF) sind systematisch unterbewertet.</li>
        </ul>
      </Card>

      <Card title="Datenquellen">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>kicker-Export-CSV</strong> (Saison 2025/26, 563 Spieler):
            Marktwert, Saisonpunkte, Note, Verein, Position. Grundlage für
            erwartete Punkte und den Spieler-Pool im Kader-Editor. Offizieller,
            offener Export — keine kicker+-Inhalte.
          </li>
          <li>
            <strong>OpenLigaDB</strong> (live, ODbL): Spielplan, Anstoßzeiten
            und Ergebnisse je Spieltag. Bestimmt, wer wann spielt (→ Deadlines,
            Auto-„raus" bei spielfreiem Verein).
          </li>
          <li>
            <strong>Deine Spieltags-News</strong>: den Start/Fraglich/Bank/Raus-
            Status pflegst du aus den Fr/Sa-Aufstellungsnews. Das ist die
            entscheidende, nirgends tabellarisch verfügbare Information.
          </li>
        </ul>
      </Card>

      <Card title="Was die App bewusst NICHT tut">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Keine Zukunfts-Vorhersage per ML.</strong> Ein ehrlicher
            Test über 4 Saisons zeigt: statische Modelle heben die Prognose nur
            minimal über den Marktwert und finden die billigen Zukunfts-Anker
            kaum — die Frage „wird er nächste Saison gesetzt sein?" steht in
            keiner Tabelle. Deshalb Regel-Engine statt Orakel.
          </li>
          <li>
            <strong>Kein Auto-Aufstellen.</strong> Die App empfiehlt, du
            bestätigst im kicker selbst. Decision-Support, kein Bot.
          </li>
        </ul>
      </Card>

      <p className="text-sm text-ink-muted">
        Zum Werkzeug: <Link href="/matchday" className="text-signal hover:underline">Spieltag optimieren</Link>{" "}
        · <Link href="/squad" className="text-signal hover:underline">Kader bearbeiten</Link>
      </p>
    </div>
  );
}
