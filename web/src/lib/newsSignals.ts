// Wandelt die News-Memory (news_log) in gewichtete Signale für den Kaderbau.
// Spieler-Ebene: Ab-/Zugang, Verletzung/Sperre, Rückkehr, Vorbereitungsform.
// Vereins-Ebene: Netto-Transferstärke (viele Zugänge = Aufwind → günstige
// Spieler höher gewichten). Alles nach Aktualität × Dauerhaftigkeit gewichtet.
"use client";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import {
  newsWeight,
  parseOutMatchdays,
  recencyWeight,
  STARTER_FLOOR,
  TYPE_LABEL,
  type NewsItem,
  type NewsType,
} from "@/lib/news";

// Basis-Delta je Typ (vor Recency-Gewicht) auf Spielerebene.
const PLAYER_DELTA: Partial<Record<NewsType, number>> = {
  transfer_out: -0.6,
  injury: -0.35,
  suspension: -0.35,
  return: 0.1,
  preseason_form: 0.15,
};

export interface PlayerSignal {
  norm: string; // normalisierter Spielername aus der News
  delta: number; // recency-gewichtet
  note: string;
  /** Erwartete Saisonpunkte, wenn die Meldung einen Stammplatz belegt.
   *  Wirkt als Untergrenze, nicht als Zuschlag. */
  floor?: number;
  floorNote?: string;
  /** Verpasste Spieltage laut Verletzungs-/Sperrmeldung. */
  outMatchdays?: number;
  outNote?: string;
}
export interface NewsSignals {
  players: PlayerSignal[];
  byClub: Record<string, { delta: number; note?: string }>;
  count: number;
}

export function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildSignals(rows: NewsItem[]): NewsSignals {
  const now = Date.now();
  const players: PlayerSignal[] = [];
  const clubAgg: Record<string, number> = {};

  for (const it of rows) {
    // Gesamtgewicht = Managerspiel-Relevanz × Aktualität.
    const w = newsWeight(it, now);
    // Spieler-Signal. Platzhalter wie "-" normalisieren zu "" und würden per
    // includes("") JEDEN Spieler matchen — deshalb Mindestlänge verlangen.
    // Achtung: Vereins-News tragen oft keinen Spielernamen — die Spieler-
    // Blöcke werden deshalb nur übersprungen, die Schleife läuft weiter.
    const pn = it.player ? norm(it.player) : "";
    if (pn.length >= 3) {
      // Stammplatz-Meldungen setzen eine Punkte-UNTERGRENZE. Nur so werden
      // billige Talente und Aufsteiger-Stammspieler sichtbar: ihre Vorsaison-
      // punkte sind nahe null und ihr Marktwert zu klein für eine Schätzung.
      if (it.type === "starter" || it.type === "preseason_form") {
        const floor = (STARTER_FLOOR[it.impact ?? 2] ?? 0) * recencyWeight(it, now);
        if (floor > 0) {
          players.push({ norm: pn, delta: 0, note: "", floor, floorNote: it.summary });
        }
      }
      // Verletzung/Sperre MIT genannter Dauer: nicht abzinsen, sondern die
      // fehlenden Spieltage festhalten.
      if (it.type === "injury" || it.type === "suspension") {
        const md = parseOutMatchdays(it.summary) ?? (it.type === "suspension" ? 1 : null);
        if (md) {
          players.push({
            norm: pn,
            delta: 0,
            note: "",
            outMatchdays: md,
            outNote: it.summary,
          });
        }
      }
      // Ist die Dauer bekannt, uebernimmt availability() die Bewertung —
      // der pauschale Abschlag entfiele sonst doppelt.
      const hasDuration =
        (it.type === "injury" || it.type === "suspension") &&
        (parseOutMatchdays(it.summary) !== null || it.type === "suspension");
      if (PLAYER_DELTA[it.type] != null && !hasDuration) {
        players.push({
          norm: pn,
          delta: PLAYER_DELTA[it.type]! * w,
          note: `${TYPE_LABEL[it.type]}${it.summary ? `: ${it.summary}` : ""}`,
        });
      }
    }
    // Vereins-Signal aus Transfers (Netto-Stärke)
    if (it.club && (it.type === "transfer_in" || it.type === "transfer_out")) {
      clubAgg[it.club] = (clubAgg[it.club] ?? 0) + (it.type === "transfer_in" ? w : -w);
    }
  }

  const byClub: Record<string, { delta: number; note?: string }> = {};
  for (const [code, net] of Object.entries(clubAgg)) {
    const delta = Math.max(-0.1, Math.min(0.15, 0.05 * net));
    byClub[code] = {
      delta,
      note: net > 0.5 ? "starker Transfersommer" : net < -0.5 ? "Aderlass im Kader" : undefined,
    };
  }
  return { players, byClub, count: rows.length };
}

/** Aggregiertes Signal + Notizen für einen Poolspieler (Namens-Matching). */
export function playerNews(
  name: string,
  signals: NewsSignals,
): {
  delta: number;
  notes: string[];
  floor: number;
  floorNote?: string;
  outMatchdays: number;
  outNote?: string;
} {
  const n = norm(name);
  let delta = 0;
  let floor = 0;
  let outMatchdays = 0;
  let floorNote: string | undefined;
  let outNote: string | undefined;
  const notes: string[] = [];
  if (n.length < 3) return { delta: 0, notes, floor: 0, outMatchdays: 0 };
  for (const s of signals.players) {
    if (s.norm === n || s.norm.includes(n) || n.includes(s.norm)) {
      delta += s.delta;
      if (s.note) notes.push(s.note);
      // stärkste Stammplatz-Meldung gewinnt, sie addieren sich nicht
      if (s.floor && s.floor > floor) {
        floor = s.floor;
        floorNote = s.floorNote;
      }
      // laengster gemeldeter Ausfall zaehlt
      if (s.outMatchdays && s.outMatchdays > outMatchdays) {
        outMatchdays = s.outMatchdays;
        outNote = s.outNote;
      }
    }
  }
  return {
    delta: Math.max(-0.8, Math.min(0.4, delta)),
    notes,
    floor,
    floorNote,
    outMatchdays,
    outNote,
  };
}

export const EMPTY_SIGNALS: NewsSignals = { players: [], byClub: {}, count: 0 };

export async function loadNewsSignals(): Promise<NewsSignals> {
  if (!supabaseEnabled || !supabase) return EMPTY_SIGNALS;
  const { data, error } = await supabase
    .from("news_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) return EMPTY_SIGNALS;
  return buildSignals(data as NewsItem[]);
}
