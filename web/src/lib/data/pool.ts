// Spieler-Pool (Bundesliga 26/27, Preseason-Bridge aus 25/26), generiert aus
// der kicker-CSV via engine/build_pool.py.
// Basis für den Kader-Editor: echte Spieler mit Verein, Position, MV, exp. Punkten.
import raw from "./players-2026.json";
import type { Position, SquadPlayer } from "@/lib/engine/types";

export interface PoolPlayer extends SquadPlayer {
  clubName: string;
  points: number;
  mv: number;
  hasHistory?: boolean; // false = kein Vorsaison-Wert (Aufsteiger/Neuzugang/Jugend)
  estPoints?: number; // Marktwert-Schätzung, wenn keine Historie vorliegt
}

/** Punkte, mit denen gerechnet wird: echte Vorsaison-Punkte, sonst die
 *  Marktwert-Schätzung (Neuzugänge sind sonst rechnerisch wertlos). */
export function effectivePoints(p: {
  points: number;
  estPoints?: number;
}): number {
  return p.points > 0 ? p.points : (p.estPoints ?? 0);
}

const BUNDLED = raw as PoolPlayer[];

// Aktiver Pool (Live-Binding): standardmäßig die gebündelte Saison, per
// setPool() zur Laufzeit durch importierte Saisondaten ersetzbar (ohne Redeploy).
export let POOL: PoolPlayer[] = BUNDLED;
let BY_ID = new Map(POOL.map((p) => [p.id!, p]));

export function setPool(rows: PoolPlayer[]): void {
  POOL = rows.length ? rows : BUNDLED;
  BY_ID = new Map(POOL.map((p) => [p.id!, p]));
}

export function poolById(id: string): PoolPlayer | undefined {
  return BY_ID.get(id);
}

function norm(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Namens-/Vereinssuche, optional auf eine Position gefiltert. */
export function searchPool(
  query: string,
  position?: Position,
  limit = 12,
): PoolPlayer[] {
  const q = norm(query.trim());
  let res = POOL;
  if (position) res = res.filter((p) => p.position === position);
  if (q) {
    res = res.filter(
      (p) => norm(p.name).includes(q) || norm(p.clubName).includes(q),
    );
  }
  return res.slice(0, limit);
}
