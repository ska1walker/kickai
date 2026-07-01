// Kaderregeln des kicker-Managerspiels (verifiziert 2024/25).
import type { Position, SquadPlayer } from "./types";

export const BUDGET = 42.5; // Mio €
export const SQUAD_SHAPE: Record<Position, number> = { TW: 3, ABW: 7, MF: 7, ST: 5 };
export const SQUAD_SIZE = 22;

export interface SquadCheck {
  valid: boolean;
  totalMv: number;
  budgetLeft: number;
  counts: Record<Position, number>;
  issues: string[];
}

export function checkSquad(squad: SquadPlayer[]): SquadCheck {
  const counts: Record<Position, number> = { TW: 0, ABW: 0, MF: 0, ST: 0 };
  let totalMv = 0;
  for (const p of squad) {
    counts[p.position] = (counts[p.position] ?? 0) + 1;
    totalMv += p.mv ?? 0;
  }
  const issues: string[] = [];
  (Object.keys(SQUAD_SHAPE) as Position[]).forEach((pos) => {
    if (counts[pos] !== SQUAD_SHAPE[pos]) {
      issues.push(`${counts[pos]}×${pos} (Soll ${SQUAD_SHAPE[pos]})`);
    }
  });
  if (totalMv > BUDGET + 1e-6) {
    issues.push(`Budget überschritten: ${totalMv.toFixed(1)} / ${BUDGET} Mio`);
  }
  return {
    valid: issues.length === 0,
    totalMv: Math.round(totalMv * 10) / 10,
    budgetLeft: Math.round((BUDGET - totalMv) * 10) / 10,
    counts,
    issues,
  };
}
