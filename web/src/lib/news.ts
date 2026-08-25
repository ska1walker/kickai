// News-Memory: Typen + Gewichtung. Dauerhafte Fakten (durable) behalten volles
// Gewicht; flüchtige Signale werden mit der Zeit nach Halbwertszeit abgewertet —
// so zählen jüngste News mehr als ältere, ohne bestätigte Fakten zu verlieren.

export type NewsType =
  | "transfer_in"
  | "transfer_out"
  | "coach"
  | "injury"
  | "suspension"
  | "return"
  | "preseason_form"
  | "starter"
  | "other";

export interface NewsItem {
  id: number;
  news_date: string;
  club: string | null;
  player: string | null;
  type: NewsType;
  durable: boolean;
  impact?: number; // 4=kritisch, 3=hoch, 2=mittel, 1=gering (fehlt bei Alt-Daten)
  summary: string;
  source: string | null;
  created_at: string;
}

export const TYPE_LABEL: Record<NewsType, string> = {
  transfer_in: "Zugang",
  transfer_out: "Abgang",
  coach: "Trainer",
  injury: "Verletzung",
  suspension: "Sperre",
  return: "Rückkehr",
  preseason_form: "Vorbereitung",
  starter: "Stammplatz",
  other: "Sonstiges",
};

// Fakten, die per se dauerhaft sind (falls das Modell durable mal nicht setzt).
export const DURABLE_TYPES: NewsType[] = [
  "transfer_in",
  "transfer_out",
  "coach",
  "suspension",
];

export const NEWS_HALFLIFE_DAYS = 12;

// Einsatz-Erwartung aus einer Stammplatz-Meldung, in Saisonpunkten.
// Hintergrund: Ein Bundesliga-Stammspieler holt grob 4,5-5 Punkte je Einsatz;
// 30 Einsaetze sind also rund 140 Punkte. Nach Belegstaerke abgestuft, weil
// "spielte 34-mal durch" etwas anderes ist als "darf mittrainieren".
// Das ist der einzige Weg, wie ein 0,5-Mio-Talent ueberhaupt sichtbar wird:
// Weder Vorsaisonpunkte noch Marktwert koennen es abbilden.
export const STARTER_FLOOR: Record<number, number> = {
  4: 130, // unangefochtener Stammspieler, "34 Spiele", "Saeule"
  3: 90, // steht in der Startelf, ueberzeugt in der Vorbereitung
  2: 40, // aussichtsreich, Einsatzzeit aber offen
  1: 0,
};

/** Gewicht 0..1: dauerhafte Fakten = 1, flüchtige Signale exponentiell fallend. */
export function recencyWeight(
  item: { durable: boolean; created_at: string },
  now: number = Date.now(),
): number {
  if (item.durable) return 1;
  const ageDays = (now - new Date(item.created_at).getTime()) / 86_400_000;
  return Math.max(0.02, Math.exp(-Math.max(0, ageDays) / NEWS_HALFLIFE_DAYS));
}

// Managerspiel-Relevanz (impact 1–4) → Faktor. Kriterium: ändert die Meldung,
// WER SPIELT oder wie viele Punkte ein Spieler bringt?
export const IMPACT_LABEL: Record<number, string> = {
  4: "kritisch",
  3: "hoch",
  2: "mittel",
  1: "gering",
};
const IMPACT_FACTOR: Record<number, number> = { 4: 1.0, 3: 0.75, 2: 0.45, 1: 0.15 };

/** Liest die Ausfalldauer aus einer Verletzungs-/Sperrmeldung und rechnet sie
 *  in verpasste Spieltage um (1 Spieltag ≈ 1 Woche). Das ist der Unterschied
 *  zwischen "ist etwas schwächer" und "kann nicht spielen": Ein prozentualer
 *  Abschlag liess einen Spieler, der zwei Monate fehlt, in der Startelf stehen.
 *  Gibt null zurück, wenn keine Dauer genannt ist. */
const NUM_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6,
  sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
};
export function parseOutMatchdays(summary: string): number | null {
  const m = summary
    .toLowerCase()
    .match(/(\d+|ein|eine|einen|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s*(?:bis\s*\S+\s*)?(woche|monat)/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : (NUM_WORDS[m[1]] ?? 1);
  const md = m[2] === "woche" ? n : n * 4.3;
  return Math.min(34, Math.round(md));
}

export function impactFactor(item: { impact?: number }): number {
  return IMPACT_FACTOR[item.impact ?? 2] ?? 0.45;
}

/** Gesamtgewicht 0..1 = Relevanz × Aktualität — die eine Zahl, mit der News
 *  in Entscheidungen einfließen. */
export function newsWeight(
  item: { durable: boolean; created_at: string; impact?: number },
  now: number = Date.now(),
): number {
  return impactFactor(item) * recencyWeight(item, now);
}
