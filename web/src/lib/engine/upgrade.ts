// Verbesserungs-Suche für einen BESTEHENDEN Kader.
//
// Anders als buildProposal() (kompletter Gegenentwurf) startet das hier bei
// Kais gespeichertem Kader und sucht die kleinsten Änderungen mit dem größten
// Effekt. Zielgröße ist bewusst die **beste aufstellbare Elf** in Punkten pro
// Spieltag — nicht der interne Rangwert: nur die Startelf punktet, und das
// Managerspiel erlaubt ohnehin nur 4 Transfers pro Saison.
//
// Zwei Formen von Vorschlägen:
//  1. Direkttausch — ein Spieler raus, ein besserer für das freie Budget rein.
//  2. Gegenfinanzierter Tausch — ein Wunschspieler ist zu teuer, also wird an
//     anderer Stelle heruntergestuft. Genau so entstand der Lemperle-Tausch.
import { BUDGET } from "./constraints";
import type { Position, SquadPlayer } from "./types";
import { effectivePoints, type PoolPlayer } from "@/lib/data/pool";

const ORDER: Position[] = ["TW", "ABW", "MF", "ST"];
// Erlaubte Startelf-Formationen (Feldspieler), inkl. der defensiven Varianten.
const FORMATIONS: Array<Record<Position, number>> = [
  { TW: 1, ABW: 3, MF: 4, ST: 3 },
  { TW: 1, ABW: 3, MF: 5, ST: 2 },
  { TW: 1, ABW: 4, MF: 4, ST: 2 },
  { TW: 1, ABW: 4, MF: 3, ST: 3 },
  { TW: 1, ABW: 4, MF: 5, ST: 1 },
  { TW: 1, ABW: 5, MF: 3, ST: 2 },
  { TW: 1, ABW: 5, MF: 4, ST: 1 },
];

export interface Upgrade {
  out: PoolPlayer[];
  in: PoolPlayer[];
  gain: number; // Punkte pro Spieltag, die die beste Elf gewinnt
  mvAfter: number;
  financed: boolean;
  headline: string;
}

/** Beste aufstellbare Elf in Punkten pro Spieltag (34 Spieltage). */
export function bestXi(squad: PoolPlayer[]): { value: number; formation: string } {
  const byPos: Record<Position, number[]> = { TW: [], ABW: [], MF: [], ST: [] };
  for (const p of squad) byPos[p.position].push(effectivePoints(p));
  for (const pos of ORDER) byPos[pos].sort((a, b) => b - a);

  let best = 0;
  let formation = "—";
  for (const f of FORMATIONS) {
    let sum = 0;
    let ok = true;
    for (const pos of ORDER) {
      if (byPos[pos].length < f[pos]) {
        ok = false;
        break;
      }
      for (let i = 0; i < f[pos]; i++) sum += byPos[pos][i];
    }
    if (ok && sum > best) {
      best = sum;
      formation = `${f.ABW}-${f.MF}-${f.ST}`;
    }
  }
  return { value: best / 34, formation };
}

const mvOf = (s: PoolPlayer[]) => s.reduce((a, p) => a + p.mv, 0);

/** Kader-Spieler auf Pool-Einträge abbilden (Punkte/Historie kommen aus dem Pool). */
export function toPoolSquad(
  squad: SquadPlayer[],
  byId: (id: string) => PoolPlayer | undefined,
): PoolPlayer[] {
  return squad.flatMap((p) => {
    const hit = p.id ? byId(p.id) : undefined;
    return hit ? [hit] : [];
  });
}

interface Options {
  maxResults?: number;
  minGain?: number; // Punkte/Spieltag, unter denen ein Vorschlag Rauschen ist
}

export function suggestUpgrades(
  squad: PoolPlayer[],
  pool: PoolPlayer[],
  opts: Options = {},
): Upgrade[] {
  const { maxResults = 8, minGain = 0.15 } = opts;
  if (squad.length === 0) return [];

  const inSquad = new Set(squad.map((p) => p.id));
  const baseXi = bestXi(squad).value;
  const baseMv = mvOf(squad);
  const free = BUDGET - baseMv;

  // Kandidaten je Position, nach Rechenpunkten sortiert — nur die Besten, sonst
  // explodiert die Suche ohne Erkenntnisgewinn.
  const cands: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };
  for (const p of pool) {
    if (inSquad.has(p.id) || p.club === "?" || !(p.mv > 0)) continue;
    cands[p.position].push(p);
  }
  for (const pos of ORDER) {
    cands[pos].sort((a, b) => effectivePoints(b) - effectivePoints(a));
    cands[pos] = cands[pos].slice(0, 40);
  }

  const found: Upgrade[] = [];
  const swapped = (out: PoolPlayer[], into: PoolPlayer[]) => {
    const ids = new Set(out.map((p) => p.id));
    return squad.filter((p) => !ids.has(p.id)).concat(into);
  };

  // --- 1. Direkttausch -------------------------------------------------------
  for (const out of squad) {
    for (const cand of cands[out.position]) {
      if (cand.mv > free + out.mv) continue;
      if (effectivePoints(cand) <= effectivePoints(out)) continue; // nie schlechter
      const next = swapped([out], [cand]);
      const gain = bestXi(next).value - baseXi;
      if (gain >= minGain) {
        found.push({
          out: [out],
          in: [cand],
          gain,
          mvAfter: mvOf(next),
          financed: false,
          headline: `${cand.name} statt ${out.name}`,
        });
      }
    }
  }

  // --- 2. Gegenfinanzierter Tausch ------------------------------------------
  // Wunschspieler, für die das Budget allein nicht reicht: an anderer Stelle
  // herunterstufen und die Differenz umschichten.
  for (const out of squad) {
    for (const cand of cands[out.position].slice(0, 12)) {
      const missing = cand.mv - out.mv - free;
      if (missing <= 0 || missing > 4) continue; // passt schon / unrealistisch
      for (const funder of squad) {
        if (funder.id === out.id || funder.mv - missing < 0.5) continue;
        const cap = funder.mv - missing;
        // billigster Ersatz für den Geldgeber, der am meisten Punkte hält
        let bestRepl: PoolPlayer | null = null;
        for (const r of cands[funder.position]) {
          if (r.mv > cap) continue;
          if (!bestRepl || effectivePoints(r) > effectivePoints(bestRepl)) bestRepl = r;
        }
        if (!bestRepl) continue;
        const next = swapped([out, funder], [cand, bestRepl]);
        if (mvOf(next) > BUDGET + 1e-6) continue;
        const gain = bestXi(next).value - baseXi;
        if (gain >= minGain) {
          found.push({
            out: [out, funder],
            in: [cand, bestRepl],
            gain,
            mvAfter: mvOf(next),
            financed: true,
            headline: `${cand.name} statt ${out.name}, finanziert über ${funder.name}`,
          });
        }
      }
    }
  }

  // Beste zuerst; pro herausgehendem Spieler nur den stärksten Vorschlag zeigen,
  // damit die Liste Entscheidungen anbietet statt Varianten desselben Zuges.
  found.sort((a, b) => b.gain - a.gain);
  const seen = new Set<string>();
  const out: Upgrade[] = [];
  for (const u of found) {
    const key = u.out.map((p) => p.id).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= maxResults) break;
  }
  return out;
}
