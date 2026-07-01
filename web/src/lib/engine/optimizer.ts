// Spieltags-Optimierer (Port aus engine/matchday_optimizer.py).
// Transparente Regel-Engine: maximiert den erwarteten Punktwert der Startelf
// unter Berücksichtigung des Einsatz-Status. Stellt nie 'out' auf.
import {
  Fixture,
  LineupPlayer,
  OptimizerResult,
  Position,
  SquadPlayer,
  Status,
  STATUS_WEIGHT,
} from "./types";
import { fixtureForClub } from "./openligadb";
import { CLUB_LABEL } from "./clubs";

const FORMATIONS: Record<string, Record<Position, number>> = {
  "3-4-3": { TW: 1, ABW: 3, MF: 4, ST: 3 },
  "3-5-2": { TW: 1, ABW: 3, MF: 5, ST: 2 },
  "4-4-2": { TW: 1, ABW: 4, MF: 4, ST: 2 },
  "4-3-3": { TW: 1, ABW: 4, MF: 3, ST: 3 },
  "4-5-1": { TW: 1, ABW: 4, MF: 5, ST: 1 },
  "5-3-2": { TW: 1, ABW: 5, MF: 3, ST: 2 },
  "5-4-1": { TW: 1, ABW: 5, MF: 4, ST: 1 },
};

const OUTFIELD: Position[] = ["ABW", "MF", "ST"];

export interface PlayerState extends SquadPlayer {
  status: Status;
  fixture: Fixture | null;
}

/** Verknüpft Kader mit Spielplan. Kein Spiel → Status 'out'. */
export function joinFixtures(
  squad: SquadPlayer[],
  fixtures: Fixture[],
  statusMap: Record<string, Status>,
): PlayerState[] {
  return squad.map((p) => {
    const fixture = fixtureForClub(fixtures, p.club);
    let status: Status = statusMap[p.name] ?? "doubt";
    if (!fixture) status = "out";
    return { ...p, fixture, status };
  });
}

function eff(p: PlayerState): number {
  return p.expPoints * STATUS_WEIGHT[p.status];
}

function opponentLabel(p: PlayerState): string {
  if (!p.fixture) return "kein Spiel";
  return p.fixture.home === p.club
    ? p.fixture.awayName
    : `@ ${p.fixture.homeName}`;
}

export function optimize(players: PlayerState[]): OptimizerResult | { error: string } {
  const avail = players.filter((p) => p.status !== "out");
  const keepers = avail
    .filter((p) => p.position === "TW")
    .sort((a, b) => eff(b) - eff(a));
  if (keepers.length === 0) return { error: "Kein einsatzfähiger Torwart im Kader." };
  const gk = keepers[0];

  let best: { formation: string; lineup: PlayerState[]; score: number } | null = null;
  for (const [fname, need] of Object.entries(FORMATIONS)) {
    const lineup: PlayerState[] = [gk];
    let feasible = true;
    for (const pos of OUTFIELD) {
      const pool = avail
        .filter((p) => p.position === pos)
        .sort((a, b) => eff(b) - eff(a));
      if (pool.length < need[pos]) {
        feasible = false;
        break;
      }
      lineup.push(...pool.slice(0, need[pos]));
    }
    if (!feasible) continue;
    const score = lineup.reduce((s, p) => s + eff(p), 0);
    if (!best || score > best.score) best = { formation: fname, lineup, score };
  }

  if (!best) return { error: "Keine gültige Formation füllbar — Kader zu dünn." };

  const lineup: LineupPlayer[] = best.lineup.map((p) => ({
    name: p.name,
    position: p.position,
    status: p.status,
    expPoints: p.expPoints,
    club: p.club,
    opponent: opponentLabel(p),
    kickoff: p.fixture?.kickoff ?? null,
  }));

  const warnings: string[] = [];
  const doubts = best.lineup.filter((p) => p.status === "doubt");
  if (doubts.length > 0) {
    warnings.push(
      `${doubts.length} fragliche Spieler in der Startelf (${doubts
        .map((p) => p.name)
        .join(", ")}) — vor Anpfiff News prüfen.`,
    );
  }
  for (const pos of OUTFIELD) {
    const safe = players.filter((p) => p.position === pos && p.status === "start");
    if (safe.length <= 1) {
      warnings.push(`Nur ${safe.length} sicherer ${pos}-Spieler — Engpass-Risiko.`);
    }
  }
  const noGame = players.filter((p) => !p.fixture);
  if (noGame.length > 0) {
    warnings.push(
      `Kein Spiel diesen Spieltag: ${noGame.map((p) => p.name).join(", ")}.`,
    );
  }

  return {
    formation: best.formation,
    expectedPoints: Math.round(best.score * 10) / 10,
    lineup,
    warnings,
  };
}

export { opponentLabel, CLUB_LABEL };
