// Spielkontext: Heimrecht und Gegnerstaerke als kleine Punktkorrektur.
//
// Beide Faktoren sind an echten Daten gemessen, nicht geschaetzt, und beide
// sind BEWUSST klein gehalten — sie sollen knappe Entscheidungen kippen,
// nicht die Rangfolge umbauen.
//
// Heimvorteil (4 Saisons, 1224 Spiele): Heimteams holen 1,77 Tore je Spiel
// gegen 1,42 auswaerts, gewinnen 43 % gegen 31 %. Ueber die gemessene
// Notenverteilung (Sieg 3,01 / Remis 3,44 / Niederlage 4,06) ergibt das
// rund 0,5 kicker-Punkte Spanne, also +/- 0,25.
//
// NICHT eingebaut: ein vereinsspezifischer Heimvorteil. Er ist rueckblickend
// deutlich sichtbar (Spannweite -0,65 bis +1,35 Punkte/Spiel), haelt aber
// nicht: Jahr-zu-Jahr-Korrelation +0,15 / -0,09 / +0,31. Mit dem praeziseren
// Mass Tordifferenz faellt sie noch weiter. Nur ~17 % der Streuung sind
// echtes Vereinssignal; der vorhersagbare Anteil liegt bei 0,4 Punkten und
// waere fuer die drei Aufsteiger ohnehin blind.
//
// Gegnerstaerke: Regression ueber 1158 Spiele aus 4 Saisons,
// Fussballpunkte ~ Kadermarktwert-Differenz, Steigung 0,0209 Punkte je Mio.
// Umgerechnet ueber "Sieg statt Niederlage = 4,2 kicker-Punkte bei 3
// Fussballpunkten" sind das 0,029 kicker-Punkte je Mio Vorsprung.
import { Fixture } from "./types";

export const HOME_BONUS = 0.25;
/** kicker-Punkte je Mio € Kadermarktwert-Vorsprung gegenueber dem Gegner. */
export const STRENGTH_PER_MIO = 0.029;
/** Deckel, damit ein Extremspiel (Bayern gegen Aufsteiger, ~58 Mio) den
 *  Erwartungswert nicht dominiert. */
export const STRENGTH_CAP = 1.5;

export type ClubStrength = Record<string, number>;

/** Kadermarktwert je Verein aus dem Spielerpool. Sentinelwerte (>= 50 Mio
 *  bedeuten "kein Marktwert gelistet") bleiben aussen vor. */
export function clubStrength(
  pool: { club: string; mv: number }[],
): ClubStrength {
  const out: ClubStrength = {};
  for (const p of pool) {
    if (p.mv >= 50) continue;
    out[p.club] = (out[p.club] ?? 0) + p.mv;
  }
  return out;
}

/** Punktkorrektur fuer einen Spieler: Heimrecht plus Gegnerstaerke.
 *  0, solange kein Spiel oder keine Vereinsstaerke bekannt ist — im Zweifel
 *  lieber nicht korrigieren als falsch korrigieren. */
export function contextBonus(
  club: string,
  fixture: Fixture | null,
  strength: ClubStrength,
): number {
  if (!fixture) return 0;
  const home = fixture.home === club;
  const opponent = home ? fixture.away : fixture.home;
  let bonus = home ? HOME_BONUS : -HOME_BONUS;
  const own = strength[club];
  const opp = opponent ? strength[opponent] : undefined;
  if (own != null && opp != null) {
    const raw = (own - opp) * STRENGTH_PER_MIO;
    bonus += Math.max(-STRENGTH_CAP, Math.min(STRENGTH_CAP, raw));
  }
  return bonus;
}
