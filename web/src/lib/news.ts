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
