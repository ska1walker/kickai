// OpenLigaDB-Client (Port aus engine/openligadb.py). Server-seitig nutzen.
import { canon } from "./clubs";
import type { Fixture } from "./types";

const BASE = "https://api.openligadb.de";

type OldbMatch = {
  matchID: number;
  matchDateTime: string | null;
  matchIsFinished: boolean;
  team1: { teamName: string };
  team2: { teamName: string };
  goals?: Array<{ goalGetterName?: string; isOwnGoal?: boolean }>;
};

export async function getMatchday(
  season: number,
  matchday: number,
): Promise<Fixture[]> {
  const res = await fetch(`${BASE}/getmatchdata/bl1/${season}/${matchday}`, {
    headers: { "User-Agent": "kick-ai/1.0" },
    // OpenLigaDB-Daten ändern sich langsam; 1h Cache auf dem Server.
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`OpenLigaDB ${res.status}`);
  const data = (await res.json()) as OldbMatch[];
  return data.map((m) => ({
    home: canon(m.team1.teamName),
    away: canon(m.team2.teamName),
    homeName: m.team1.teamName,
    awayName: m.team2.teamName,
    kickoff: m.matchDateTime,
    finished: Boolean(m.matchIsFinished),
    matchId: m.matchID,
  }));
}

export async function getCurrentMatchday(): Promise<number | null> {
  const res = await fetch(`${BASE}/getcurrentgroup/bl1`, {
    headers: { "User-Agent": "kick-ai/1.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const g = (await res.json()) as { groupOrderID?: number };
  return g.groupOrderID ?? null;
}

export function fixtureForClub(
  fixtures: Fixture[],
  clubCode: string | null,
): Fixture | null {
  if (!clubCode) return null;
  return fixtures.find((f) => f.home === clubCode || f.away === clubCode) ?? null;
}
