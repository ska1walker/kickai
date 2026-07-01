// Strategie-Signale für den Kaderbau — die "Ceiling-Plays" zum Liga-Gewinnen:
//  #4 Abwehr-Stacking: Torwart + Abwehr eines starken Defensivteams korrelieren
//     (Zu-Null → TW +2 UND gute Noten der ganzen Kette gleichzeitig).
//  #5 Standard-/Elfmeterschützen: unterbepreiste Punkte-Böden (ABW-Tor = +5).
//  #6 Anker-Cluster: das eine Team mit vielen billigen Stammspielern früh laden.
import { POOL, type PoolPlayer } from "@/lib/data/pool";
import { type NewsSignals } from "@/lib/newsSignals";
import { norm } from "@/lib/newsSignals";

export type SetPieceRole = "penalty" | "freekick" | "corner";
export interface StrategyInput {
  stackDefense: boolean;
  setPieceTakers: Record<string, SetPieceRole>; // normalisierter Name → Rolle
}
export const EMPTY_STRATEGY: StrategyInput = { stackDefense: false, setPieceTakers: {} };

export interface StrategyResult {
  deltaById: Map<string, number>;
  notesById: Map<string, string[]>;
  clusterClubs: { club: string; anchors: number }[];
  stackClub: string | null;
}

const ANCHOR_MV = 2.5;
const ANCHOR_PTS = 120;

function add(map: Map<string, number>, id: string, d: number) {
  map.set(id, (map.get(id) ?? 0) + d);
}
function note(map: Map<string, string[]>, id: string, s: string) {
  (map.get(id) ?? map.set(id, []).get(id)!).push(s);
}

export function computeStrategy(input: StrategyInput, news: NewsSignals): StrategyResult {
  const valid = POOL.filter((p) => p.club !== "?");
  const byClub = new Map<string, PoolPlayer[]>();
  for (const p of valid) (byClub.get(p.club) ?? byClub.set(p.club, []).get(p.club)!).push(p);

  const deltaById = new Map<string, number>();
  const notesById = new Map<string, string[]>();

  // #6 Anker-Cluster: Vereine mit vielen billigen Stammspielern (Vorsaison).
  const clusterClubs = [...byClub.entries()]
    .map(([club, ps]) => ({
      club,
      anchors: ps.filter((p) => p.mv <= ANCHOR_MV && p.points >= ANCHOR_PTS).length,
    }))
    .filter((c) => c.anchors >= 3)
    .sort((a, b) => b.anchors - a.anchors);
  const topClusters = new Set(clusterClubs.slice(0, 2).map((c) => c.club));
  for (const p of valid) {
    if (topClusters.has(p.club) && p.mv <= ANCHOR_MV && p.points >= ANCHOR_PTS) {
      // Cluster schrumpft, wenn News Abgänge melden → abschwächen.
      const clubNews = news.byClub[p.club]?.delta ?? 0;
      const d = clubNews < 0 ? 0.04 : 0.08;
      add(deltaById, p.id!, d);
      note(notesById, p.id!, "Anker-Cluster");
    }
  }

  // #4 Abwehr-Stack: stärkstes Defensivteam (TW + Top-3 ABW nach Punkten).
  let stackClub: string | null = null;
  let bestDef = -1;
  for (const [club, ps] of byClub) {
    const tw = Math.max(0, ...ps.filter((p) => p.position === "TW").map((p) => p.points));
    const abw = ps
      .filter((p) => p.position === "ABW")
      .map((p) => p.points)
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((s, v) => s + v, 0);
    const def = tw + abw;
    if (def > bestDef) {
      bestDef = def;
      stackClub = club;
    }
  }
  if (input.stackDefense && stackClub) {
    for (const p of byClub.get(stackClub) ?? []) {
      if (p.position === "TW" || p.position === "ABW") {
        add(deltaById, p.id!, 0.12);
        note(notesById, p.id!, "Abwehr-Stack (korrelierte Zu-Null)");
      }
    }
  }

  // #5 Standard-/Elfmeterschützen: recherchierte Schützen (Namens-Matching).
  const takers = Object.entries(input.setPieceTakers);
  if (takers.length) {
    for (const p of valid) {
      const n = norm(p.name);
      for (const [name, role] of takers) {
        if (name === n || name.includes(n) || n.includes(name)) {
          // ABW-Tor = +5 → Verteidiger-Schützen extra wertvoll.
          const base = role === "penalty" ? 0.15 : 0.08;
          add(deltaById, p.id!, p.position === "ABW" ? base + 0.05 : base);
          note(notesById, p.id!, role === "penalty" ? "Elfmeterschütze" : "Standards");
          break;
        }
      }
    }
  }

  return { deltaById, notesById, clusterClubs, stackClub };
}
