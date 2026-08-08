// Default-Kader: bewährte 25/26-Anker, aus dem aktiven Spieler-Pool per ID abgeleitet
// (eine Quelle der Wahrheit — Name/Verein/Position/MV/exp. Punkte aus der CSV).
import type { SquadPlayer } from "@/lib/engine/types";
import { poolById } from "./pool";

export const DEFAULT_SEASON = 2026; // = Saison 2026/27

const SEED_IDS = [
  "pl-k00118051", "pl-k00054360", "pl-k00039161", // TW
  "pl-k00081053", "pl-k00155823", "pl-k00096140", "pl-k00087750",
  "pl-k00161346", "pl-k00149673", "pl-k00149407", // ABW
  "pl-k00059041", "pl-k00102800", "pl-k00088240", "pl-k00159629",
  "pl-k00104010", "pl-k00151366", "pl-k00168200", // MF
  "pl-k00070605", "pl-k00176299", "pl-k00174794", "pl-k00094599",
  "pl-k00158876", // ST
];

// Tolerant: Spieler, die die Liga verlassen haben, fallen still raus — der
// echte Kader entsteht ohnehin über /aufbau bzw. den Kader-Editor.
export const SEED_SQUAD: SquadPlayer[] = SEED_IDS.flatMap((id) => {
  const p = poolById(id);
  if (!p) return [];
  return [{
    id: p.id,
    name: p.name,
    club: p.club,
    position: p.position,
    expPoints: p.expPoints,
    mv: p.mv,
  }];
});
