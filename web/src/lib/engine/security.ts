// Einsatzsicherheit / Stammplatz-Score (deterministisch aus den Pooldaten).
// Kernbefund: Punkte = Einsatzmenge. Punkte allein vermischen aber Qualität ×
// Minuten. Dieser Score ergänzt die Dimension "war der Spieler der klare
// Stammspieler auf seiner Position im Verein?" — über den Anteil an den Punkten
// der Positionskonkurrenz im selben Klub plus einen Minuten-Proxy.
//
// Für eine per Bridge übernommene neue Saison basiert das auf Vorsaisondaten
// (bester verfügbarer Proxy); Spieler ohne Historie → "unklar" (Scout/News).
import { POOL, type PoolPlayer } from "@/lib/data/pool";

export type SecLabel = "hoch" | "mittel" | "rotation" | "unklar";
export interface SecInfo {
  score: number; // 0..1
  label: SecLabel;
}

const MINUTES_FULL = 150; // ~Punkte eines soliden Ganzjahres-Stammspielers

function labelFor(score: number, points: number): SecLabel {
  if (points <= 0) return "unklar";
  if (score >= 0.75) return "hoch";
  if (score >= 0.45) return "mittel";
  return "rotation";
}

export function computeSecurity(): Map<string, SecInfo> {
  // Gruppen: Verein + Position.
  const groups = new Map<string, PoolPlayer[]>();
  for (const p of POOL) {
    if (p.club === "?") continue;
    const k = `${p.club}|${p.position}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
  }

  const m = new Map<string, SecInfo>();
  for (const g of groups.values()) {
    const best = Math.max(...g.map((p) => p.points), 0);
    for (const p of g) {
      const minutesProxy = Math.max(0, Math.min(1, p.points / MINUTES_FULL));
      // Dominanz auf dem Positions-Slot des Klubs (1 = klarer Nummer-1).
      const share = best > 0 ? p.points / best : 0;
      const score = 0.4 * minutesProxy + 0.6 * share;
      m.set(p.id!, { score, label: labelFor(score, p.points) });
    }
  }
  return m;
}

// Sanfter Builder-Faktor: hoch ≈ 1.1, Rotation ≈ 0.9 — Punkte kodieren Minuten
// schon teilweise, daher bewusst dezent (± ~10%).
export function securityFactor(sec: SecInfo | undefined): number {
  if (!sec || sec.label === "unklar") return 1;
  return 0.9 + 0.2 * sec.score;
}
