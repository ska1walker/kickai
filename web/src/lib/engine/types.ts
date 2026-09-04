// Geteilte Typen der Decision-Engine (Port aus engine/*.py).

export type Position = "TW" | "ABW" | "MF" | "ST";
export type Status = "start" | "doubt" | "bench" | "out";

export interface SquadPlayer {
  name: string;
  id?: string;
  club: string;        // kanonischer Vereinscode (siehe clubs.ts)
  position: Position;
  expPoints: number;   // erwarteter Punktwert pro Spieltag
  mv?: number;         // Marktwert in Mio € (für Budget)
}

export interface Fixture {
  home: string | null;      // kanonischer Code
  away: string | null;
  homeName: string;
  awayName: string;
  kickoff: string | null;   // ISO
  finished: boolean;
  matchId: number;
}

export interface LineupPlayer {
  name: string;
  position: Position;
  status: Status;
  expPoints: number;
  club: string;
  opponent: string;
  kickoff: string | null;
}

/** Wer koennte einen Startelfspieler noch ersetzen, wenn er kurzfristig
 *  ausfaellt? Nur Spieler, die SPAETER anstossen, kommen dafuer in Frage —
 *  ein Ersatz, dessen Spiel schon laeuft, bringt nichts mehr. */
export interface Coverage {
  name: string;
  position: Position;
  kickoff: string | null;
  backups: string[];   // Namen, nach Anstoss sortiert
}

export interface OptimizerResult {
  formation: string;
  expectedPoints: number;
  lineup: LineupPlayer[];
  warnings: string[];
  coverage: Coverage[];
}

export const STATUS_WEIGHT: Record<Status, number> = {
  start: 1.0,
  doubt: 0.55,
  bench: 0.2,
  out: 0.0,
};

export const STATUS_LABEL: Record<Status, string> = {
  start: "gesetzt",
  doubt: "fraglich",
  bench: "Bank",
  out: "raus",
};
