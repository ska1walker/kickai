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
