// Warnbanner: Kaderspieler, für die eine Verletzungs- oder Sperrmeldung mit
// Dauer vorliegt. Existiert, weil vier verletzte Stammspieler unbemerkt in der
// Startelf standen — die Meldungen lagen in der Memory, aber nirgends sichtbar.
"use client";
import type { NewsSignals } from "@/lib/newsSignals";
import { playerNews } from "@/lib/newsSignals";
import type { SquadPlayer } from "@/lib/engine/types";

export interface OutPlayer {
  player: SquadPlayer;
  matchdays: number;
  note?: string;
}

export function findOutPlayers(squad: SquadPlayer[], news: NewsSignals): OutPlayer[] {
  return squad
    .map((p) => {
      const n = playerNews(p.name, news);
      return { player: p, matchdays: n.outMatchdays, note: n.outNote };
    })
    .filter((o) => o.matchdays > 0)
    .sort((a, b) => b.matchdays - a.matchdays);
}

export function InjuryWarning({ out }: { out: OutPlayer[] }) {
  if (!out.length) return null;
  const long = out.filter((o) => o.matchdays >= 4);
  return (
    <div className="card border-signal p-4">
      <p className="label-caps text-signal-700">
        {out.length} {out.length === 1 ? "Spieler fällt aus" : "Spieler fallen aus"}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {out.map((o) => (
          <li key={o.player.id} className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">{o.player.name}</span>
            <span className="font-mono text-xs text-signal-700">
              fehlt ~{o.matchdays} {o.matchdays === 1 ? "Spieltag" : "Spieltage"}
            </span>
            {o.note && <span className="text-xs text-ink-muted">{o.note}</span>}
          </li>
        ))}
      </ul>
      {long.length > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Ab vier fehlenden Spieltagen lohnt ein Tausch — vor dem ersten Spieltag
          ist er kostenlos, danach kostet er einen der vier Saisontransfers.
        </p>
      )}
    </div>
  );
}
