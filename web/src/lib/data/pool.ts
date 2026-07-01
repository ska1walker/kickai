// Spieler-Pool (Bundesliga 25/26), generiert aus der kicker-CSV.
// Basis für den Kader-Editor: echte Spieler mit Verein, Position, MV, exp. Punkten.
import raw from "./players-2025.json";
import type { Position, SquadPlayer } from "@/lib/engine/types";

export interface PoolPlayer extends SquadPlayer {
  clubName: string;
  points: number;
  mv: number;
  hasHistory?: boolean; // false = kein Vorsaison-Wert (Aufsteiger/Neuzugang/Jugend)
}

export const POOL = raw as PoolPlayer[];

const BY_ID = new Map(POOL.map((p) => [p.id!, p]));

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
