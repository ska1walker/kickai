// Kader-Vorschlags-Engine (deterministisch, erklärbar).
// Baut aus dem Spieler-Pool einen budget- und strukturkonformen Kader:
// pro Slot eine Top-Empfehlung + 2 Alternativen, jeweils mit Begründung.
//
// Leitidee (aus der Datenanalyse): Effizienz-Anker — viel Output pro Euro,
// bevorzugt defensive Dauerläufer. Zusätzlich fließen ein:
//  - Team-Tier-Erwartung (günstige Spieler erwarteter Überraschungsteams),
//  - News-Memory (Ab-/Zugänge, Verletzungen, Vorbereitung, Transferstärke),
//    jeweils recency-gewichtet.
import { POOL, effectivePoints, type PoolPlayer } from "@/lib/data/pool";
import { BUDGET, SQUAD_SHAPE } from "./constraints";
import type { Position } from "./types";
import { playerNews, EMPTY_SIGNALS, type NewsSignals } from "@/lib/newsSignals";
import { computeSecurity, securityFactor, type SecInfo } from "./security";
import { computeStrategy, EMPTY_STRATEGY, type StrategyInput } from "./strategy";

export type Tier = "top" | "surprise" | "mid" | "lower";
export interface TierInfo {
  tier: Tier;
  reason?: string;
}
export type Tiers = Record<string, TierInfo>; // clubCode → Tier

export interface Alt {
  player: PoolPlayer;
  reason: string;
}
export interface Pick {
  player: PoolPlayer;
  role: "premium" | "filler";
  reason: string;
  alternatives: Alt[];
  security?: SecInfo;
}
export interface Proposal {
  byPos: Record<Position, Pick[]>;
  totalMv: number;
  totalPoints: number;
  bestXiExp: number; // erwartete Punkte der besten aufstellbaren Elf pro Spieltag
  newsUsed: number;
  clusterClubs: { club: string; anchors: number }[]; // #6 Anker-Cluster
  stackClub: string | null; // #4 empfohlenes Abwehr-Stack-Team
}

const ORDER: Position[] = ["TW", "ABW", "MF", "ST"];
// #1 „einsetzbare Elf": Budget auf 14 echte Starter konzentrieren (1-5-5-3),
// nur 8 Plätze mit billigsten Bankspielern füllen (die nie starten).
const PREMIUM: Record<Position, number> = { TW: 1, ABW: 5, MF: 5, ST: 3 };
// Beste-Elf-Formationen (Feldspieler) für die Startelf-Stärke-Metrik.
const XI_FORMATIONS: Array<Record<Position, number>> = [
  { TW: 1, ABW: 3, MF: 4, ST: 3 },
  { TW: 1, ABW: 3, MF: 5, ST: 2 },
  { TW: 1, ABW: 4, MF: 4, ST: 2 },
  { TW: 1, ABW: 4, MF: 3, ST: 3 },
  { TW: 1, ABW: 5, MF: 3, ST: 2 },
  { TW: 1, ABW: 4, MF: 5, ST: 1 },
];
const POS_WEIGHT: Record<Position, number> = { TW: 0.9, ABW: 1.05, MF: 1.05, ST: 1.0 };

// Team-Stärke wirkt je nach Preisklasse GEGENSÄTZLICH — gemessen über 4 Saisons
// (Teams nach Kader-Marktwert in Terzile, Punkte-Mittel relativ zum Schnitt):
//   günstig ≤2.5M : starkes Team 0.83× · Mittelfeld 1.08× · schwaches Team 1.09×
//   mittel 2.5–4M : 0.94× · 1.00× · 1.06×
//   teuer   >4M   : 1.23× · 0.77× · (kein Fall)
// Ursache: Ein billiger Spieler bei Bayern ist Ersatzmann, ein billiger Spieler
// beim Aufsteiger ist Stammspieler — und Punkte kommen aus Einsatzminuten.
// Ein pauschaler Top-Bonus (früher +0.05 für alle) bestrafte damit genau die
// Anker-Jagd. Werte auf ~70% der Messung geschrumpft (Rauschen).
const TIER_BONUS_BY_SEGMENT: Record<"cheap" | "mid" | "premium", Record<Tier, number>> = {
  cheap: { top: -0.12, surprise: 0.12, mid: 0.06, lower: 0.06 },
  mid: { top: -0.04, surprise: 0.12, mid: 0, lower: 0.04 },
  premium: { top: 0.15, surprise: 0.15, mid: -0.04, lower: -0.1 },
};
function priceSegment(mv: number): "cheap" | "mid" | "premium" {
  return mv <= 2.5 ? "cheap" : mv <= 4 ? "mid" : "premium";
}
const SEGMENT_NOTE: Record<"cheap" | "mid" | "premium", string> = {
  cheap:
    "billiges Segment: hier zahlt sich ein Top-Verein NICHT aus (Ersatzbank), günstige Spieler schwächerer Teams spielen häufiger",
  mid: "mittleres Segment: Vereinsstärke wirkt nur schwach",
  premium: "teures Segment: hier zahlt sich ein starker Verein aus (1.23× über 4 Saisons)",
};
function tierBonus(tier: Tier, mv: number): number {
  return TIER_BONUS_BY_SEGMENT[priceSegment(mv)][tier];
}
// Bewusst als "Verein …" formuliert: sonst liest sich die Tier-Einordnung
// "Mittelfeld" wie eine Positionsangabe des Spielers.
const TIER_LABEL: Record<Tier, string> = {
  top: "Verein im Spitzenfeld erwartet",
  surprise: "Verein als Überraschungskandidat fürs obere Drittel",
  mid: "Verein im Tabellen-Mittelfeld erwartet",
  lower: "Verein im unteren Drittel erwartet",
};

// Rechenpunkte: echte Vorsaison-Punkte, sonst Marktwert-Schaetzung.
const pts = (p: PoolPlayer) => effectivePoints(p);
const ppm = (p: PoolPlayer) => pts(p) / Math.max(p.mv, 0.5);

// Der Marktwert sagt, was der Verein GEZAHLT hat — nicht, ob der Spieler
// spielt. Punkte kommen aber aus Einsatzminuten (Korr 0.69 vs. Note ~0).
//
// KALIBRIERT an 3 Saisonübergängen: Marktwert-Modell auf Etablierten gefittet,
// auf echte Neuzugänge angewandt → sie holten 0.84 / 0.72 / 0.81 des prognosti-
// zierten Werts, im Mittel 0.79. Dieser Abschlag steckt bereits in estPoints.
// Der Evidenz-Faktor darf deshalb nur noch SPREIZEN, nicht nochmals dämpfen —
// sonst wären Neuzugänge doppelt bestraft (frühere Kombi 0.45 statt 0.79).
const UNCONFIRMED = 0.85; // ohne Vorbereitungs-/News-Beleg
const CONFIRMED = 1.15; // mit Testspiel-/Kadermeldung
function evidenceFactor(p: PoolPlayer, nm: NewsMap): number {
  if (p.hasHistory !== false) return 1; // belegte Vorsaison-Daten
  return (nm.get(p.id!)?.notes.length ?? 0) > 0 ? CONFIRMED : UNCONFIRMED;
}

// Vorberechnete News-Deltas + Notizen je Spieler-ID (Namens-Matching einmalig).
type NewsMap = Map<string, { delta: number; notes: string[] }>;

function adj(
  p: PoolPlayer,
  tiers: Tiers,
  news: NewsSignals,
  nm: NewsMap,
  sec: Map<string, SecInfo>,
  strat: Map<string, number>,
): number {
  const bonus = tiers[p.club]?.tier ? tierBonus(tiers[p.club].tier, p.mv) : 0;
  const clubDelta = news.byClub[p.club]?.delta ?? 0;
  const playerDelta = nm.get(p.id!)?.delta ?? 0;
  const stratDelta = strat.get(p.id!) ?? 0; // #4/#5/#6 Strategie
  const secF = securityFactor(sec.get(p.id!)); // #2 Einsatzsicherheit
  return (
    pts(p) *
    evidenceFactor(p, nm) *
    POS_WEIGHT[p.position] *
    (1 + bonus) *
    (1 + clubDelta + playerDelta + stratDelta) *
    secF
  );
}

function tierNote(p: PoolPlayer, tiers: Tiers): string {
  const info = tiers[p.club];
  if (!info) return "";
  const base = ` · ${TIER_LABEL[info.tier]}`;
  return info.reason ? `${base}: ${info.reason}` : base;
}
function newsNote(p: PoolPlayer, news: NewsSignals, nm: NewsMap): string {
  const parts: string[] = [];
  const club = news.byClub[p.club]?.note;
  if (club) parts.push(club);
  parts.push(...(nm.get(p.id!)?.notes ?? []));
  return parts.length ? ` · News: ${parts.join("; ")}` : "";
}
function histNote(p: PoolPlayer, nm?: NewsMap): string {
  if (p.hasHistory !== false) return "";
  const confirmed = nm ? (nm.get(p.id!)?.notes.length ?? 0) > 0 : false;
  return confirmed
    ? " · keine Vorsaison-Daten, aber durch Vorbereitung/News bestätigt"
    : " · keine Vorsaison-Daten und noch keine Vorbereitungs-/News-Bestätigung — bewusst abgewertet";
}
function stratNote(p: PoolPlayer, sn: Map<string, string[]>): string {
  const n = sn.get(p.id!);
  return n && n.length ? ` · ${n.join("; ")}` : "";
}

/** Ein Schritt im Rechenweg: Faktor, was er in Punkten bewirkt, und warum. */
export interface ScoreStep {
  label: string;
  factor: number; // Multiplikator
  delta: number; // Punkte-Wirkung dieses Schritts
  why: string;
}
export interface ScoreBreakdown {
  base: number; // Rechenpunkte vor allen Faktoren
  baseLabel: string;
  steps: ScoreStep[];
  score: number; // Endwert, nach dem sortiert wird
}

/** Legt den Rechenweg für einen Spieler offen — exakt die Faktoren aus adj(),
 *  in derselben Reihenfolge, mit ihrer Wirkung in Punkten. Damit ist jede
 *  Empfehlung Schritt für Schritt nachprüfbar. */
export function explainScore(
  p: PoolPlayer,
  tiers: Tiers,
  news: NewsSignals,
  strategy: StrategyInput = EMPTY_STRATEGY,
  sec?: Map<string, SecInfo>,
): ScoreBreakdown {
  const nm: NewsMap = new Map([[p.id!, playerNews(p.name, news)]]);
  const strat = computeStrategy(strategy, news);
  const security = (sec ?? computeSecurity()).get(p.id!);

  const base = pts(p);
  const baseLabel =
    p.points > 0
      ? `${p.points} Pkt aus der Vorsaison`
      : p.estPoints
        ? `${p.estPoints} Pkt Richtwert aus dem Marktwert (${p.mv.toFixed(1)}M)`
        : `0 Pkt — keine Datenbasis`;

  const steps: ScoreStep[] = [];
  let running = base;
  // force = Schritt auch bei Faktor 1.00 zeigen: der Leser soll sehen, dass
  // die Dimension geprüft wurde und schlicht neutral ausfiel.
  const push = (label: string, factor: number, why: string, force = false) => {
    if (!force && Math.abs(factor - 1) < 1e-9) return;
    const delta = running * factor - running;
    running *= factor;
    steps.push({ label, factor, delta, why });
  };

  const ev = evidenceFactor(p, nm);
  if (p.hasHistory === false) {
    push(ev < 1 ? "Ohne Bestätigung" : "Durch Vorbereitung/News bestätigt", ev,
      ev < 1
        ? "Marktwert zeigt die Investition, nicht die Einsatzzeit — ohne Testspiel-/Kaderbeleg zurückhaltender bewertet"
        : "Testspiel-/Kadermeldung liegt vor — Richtwert wird angehoben",
      true);
  }
  push(`Position ${p.position}`, POS_WEIGHT[p.position],
    p.position === "TW"
      ? "Torhüter punkten stabil, aber ohne Tor-/Assist-Aufschlag"
      : p.position === "ST"
        ? "Stürmertor zählt nur 3 Pkt (Abwehr 5, TW 6) — kein Aufschlag"
        : "Tore aus der Tiefe zählen 4–5 Pkt und Dauerläufer sind hier unterbewertet",
    true);
  const tier = tiers[p.club]?.tier;
  if (tier) {
    push(`Vereins-Erwartung: ${TIER_LABEL[tier]}`, 1 + tierBonus(tier, p.mv),
      `${SEGMENT_NOTE[priceSegment(p.mv)]} — ${tiers[p.club]?.reason || "aus der Team-Tier-Recherche"}`, true);
  } else {
    push("Vereins-Erwartung", 1,
      "noch keine Team-Tier-Recherche gelaufen — auf /aufbau anstoßen", true);
  }
  const clubDelta = news.byClub[p.club]?.delta ?? 0;
  if (clubDelta) {
    push("Vereins-News (Transferbilanz)", 1 + clubDelta,
      news.byClub[p.club]?.note ?? "Netto-Transferstärke aus der News-Memory");
  }
  const pn = nm.get(p.id!);
  push("Spieler-News", 1 + (pn?.delta ?? 0),
    pn?.notes.length
      ? pn.notes.join("; ")
      : "keine Meldung zu diesem Spieler in der News-Memory", true);
  const sd = strat.deltaById.get(p.id!) ?? 0;
  if (sd) {
    push("Strategie (Ceiling-Play)", 1 + sd,
      (strat.notesById.get(p.id!) ?? []).join("; ") || "aktivierte Strategie");
  }
  const secF = securityFactor(security);
  push(`Einsatzsicherheit: ${security?.label ?? "unklar"}`, secF,
    security
      ? `Stammplatz-Score ${(security.score * 100).toFixed(0)}% (Minuten-Proxy + Dominanz auf der Vereinsposition)`
      : "keine Vorsaisondaten zur Einordnung");

  return { base, baseLabel, steps, score: running };
}

/** Nachvollziehbare Begründung für einen einzelnen (Kader-)Spieler — dieselben
 *  Bausteine wie im Vorschlag: Vorsaison-Basis, Tier-Einordnung, News, Historie.
 *  Wird u.a. im Kader-Editor unter jedem Spieler angezeigt. */
export function explainPlayer(p: PoolPlayer, tiers: Tiers, news: NewsSignals): string {
  const nm: NewsMap = new Map([[p.id!, playerNews(p.name, news)]]);
  const base =
    p.points > 0
      ? `${p.points} Pkt Vorsaison bei ${p.mv.toFixed(1)}M (${ppm(p).toFixed(0)} P/Mio)`
      : p.estPoints
        ? `Ohne Vorsaison-Daten — Richtwert ${p.estPoints} Pkt aus dem Marktwert (${p.mv.toFixed(1)}M); der Marktwert zeigt die Investition, nicht die Einsatzzeit`
        : `Günstiger Kaderplatz (${p.mv.toFixed(1)}M) — spart Budget für die Startelf`;
  return `${base}${tierNote(p, tiers)}${newsNote(p, news, nm)}${histNote(p, nm)}`;
}

// "247 Pkt" bei echten Daten, "gesch. 133 Pkt" wenn nur der Marktwert vorliegt.
const basePts = (p: PoolPlayer) =>
  p.points > 0 ? `${p.points} Pkt` : `gesch. ${p.estPoints ?? 0} Pkt`;

function premiumReason(p: PoolPlayer, tiers: Tiers, news: NewsSignals, nm: NewsMap, sn: Map<string, string[]>): string {
  return `${basePts(p)} bei ${p.mv.toFixed(1)}M (${ppm(p).toFixed(0)} P/Mio) · ${p.clubName}${tierNote(p, tiers)}${newsNote(p, news, nm)}${stratNote(p, sn)}${histNote(p, nm)}`;
}
function fillerReason(p: PoolPlayer, news: NewsSignals, nm: NewsMap, sn: Map<string, string[]>): string {
  return `Günstiger Bankplatz (${p.mv.toFixed(1)}M) · ${p.clubName} — spart Budget für die Startelf${newsNote(p, news, nm)}${stratNote(p, sn)}`;
}
function altReason(p: PoolPlayer, tiers: Tiers, news: NewsSignals, nm: NewsMap, sn: Map<string, string[]>): string {
  return `${basePts(p)} / ${p.mv.toFixed(1)}M${tierNote(p, tiers)}${newsNote(p, news, nm)}${stratNote(p, sn)}${histNote(p, nm)}`;
}

export function buildProposal(
  tiers: Tiers = {},
  news: NewsSignals = EMPTY_SIGNALS,
  strategy: StrategyInput = EMPTY_STRATEGY,
): Proposal {
  const valid = POOL.filter((p) => p.mv > 0 && p.mv < 100 && p.club !== "?");
  // News-Deltas/Notizen + Einsatzsicherheit + Strategie einmal vorberechnen.
  const nm: NewsMap = new Map();
  if (news.count) for (const p of valid) nm.set(p.id!, playerNews(p.name, news));
  const sec = computeSecurity();
  const strat = computeStrategy(strategy, news);

  const byPosPool: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };
  for (const p of valid) byPosPool[p.position].push(p);

  const selected = new Set<string>();
  const premiumByPos: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };
  const fillerByPos: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };
  const A = (p: PoolPlayer) => adj(p, tiers, news, nm, sec, strat.deltaById);

  for (const pos of ORDER) {
    const ranked = [...byPosPool[pos]].sort((a, b) => A(b) - A(a));
    const premium = ranked.slice(0, PREMIUM[pos]);
    premium.forEach((p) => selected.add(p.id!));
    premiumByPos[pos] = premium;
    const rest = ranked.filter((p) => !selected.has(p.id!));
    const cheapest = [...rest].sort((a, b) => a.mv - b.mv);
    const filler = cheapest.slice(0, SQUAD_SHAPE[pos] - PREMIUM[pos]);
    filler.forEach((p) => selected.add(p.id!));
    fillerByPos[pos] = filler;
  }

  const totalMv = () =>
    ORDER.reduce(
      (s, pos) =>
        s +
        premiumByPos[pos].reduce((a, p) => a + p.mv, 0) +
        fillerByPos[pos].reduce((a, p) => a + p.mv, 0),
      0,
    );

  // Budget-Fix: schlechtesten Premium-Wert (adj/mv) durch günstigeren ersetzen.
  let guard = 0;
  while (totalMv() > BUDGET && guard++ < 500) {
    let worst: { pos: Position; idx: number; p: PoolPlayer } | null = null;
    for (const pos of ORDER) {
      premiumByPos[pos].forEach((p, idx) => {
        if (p.mv <= 0.5) return;
        if (!worst || A(p) / p.mv < A(worst.p) / worst.p.mv) worst = { pos, idx, p };
      });
    }
    if (!worst) break;
    const w = worst as { pos: Position; idx: number; p: PoolPlayer };
    const replacement = [...byPosPool[w.pos]]
      .filter((c) => !selected.has(c.id!) && c.mv < w.p.mv)
      .sort((a, b) => A(b) - A(a))[0];
    if (!replacement) break;
    selected.delete(w.p.id!);
    selected.add(replacement.id!);
    premiumByPos[w.pos][w.idx] = replacement;
  }

  const byPos: Record<Position, Pick[]> = { TW: [], ABW: [], MF: [], ST: [] };
  for (const pos of ORDER) {
    const premAlts = [...byPosPool[pos]]
      .filter((p) => !selected.has(p.id!))
      .sort((a, b) => A(b) - A(a));
    const cheapAlts = [...byPosPool[pos]]
      .filter((p) => !selected.has(p.id!))
      .sort((a, b) => a.mv - b.mv);

    // Alternativen dürfen sich zwischen den Slots NICHT wiederholen: sonst
    // konnte derselbe Spieler in zwei Slots gewählt werden und landete doppelt
    // im Kader — beim Speichern kollidierten die IDs und die Position blieb
    // unterbesetzt.
    const usedAlts = new Set<string>();
    const takeAlts = (from: PoolPlayer[], limit: number, maxMv?: number) => {
      const out: PoolPlayer[] = [];
      for (const a of from) {
        if (out.length >= limit) break;
        if (usedAlts.has(a.id!)) continue;
        if (maxMv != null && a.mv > maxMv) continue;
        usedAlts.add(a.id!);
        out.push(a);
      }
      return out;
    };

    for (const p of premiumByPos[pos]) {
      byPos[pos].push({
        player: p,
        role: "premium",
        security: sec.get(p.id!),
        reason: premiumReason(p, tiers, news, nm, strat.notesById),
        alternatives: takeAlts(premAlts, 2, p.mv * 1.2).map((a) => ({
          player: a,
          reason: altReason(a, tiers, news, nm, strat.notesById),
        })),
      });
    }
    for (const p of fillerByPos[pos]) {
      byPos[pos].push({
        player: p,
        role: "filler",
        security: sec.get(p.id!),
        reason: fillerReason(p, news, nm, strat.notesById),
        alternatives: takeAlts(cheapAlts, 2).map((a) => ({
          player: a,
          reason: altReason(a, tiers, news, nm, strat.notesById),
        })),
      });
    }
  }

  // #1 Beste-Elf-Stärke: erwartete Punkte der besten aufstellbaren Elf/Spieltag.
  const expByPos: Record<Position, number[]> = { TW: [], ABW: [], MF: [], ST: [] };
  for (const pos of ORDER)
    expByPos[pos] = byPos[pos].map((pk) => pk.player.expPoints).sort((a, b) => b - a);
  let bestXiExp = 0;
  for (const f of XI_FORMATIONS) {
    let sum = 0;
    let ok = true;
    for (const pos of ORDER) {
      if (expByPos[pos].length < f[pos]) { ok = false; break; }
      sum += expByPos[pos].slice(0, f[pos]).reduce((s, v) => s + v, 0);
    }
    if (ok) bestXiExp = Math.max(bestXiExp, sum);
  }

  const flat = ORDER.flatMap((pos) => byPos[pos]);
  return {
    byPos,
    totalMv: Math.round(flat.reduce((s, p) => s + p.player.mv, 0) * 10) / 10,
    totalPoints: flat.reduce((s, p) => s + pts(p.player), 0),
    bestXiExp: Math.round(bestXiExp * 10) / 10,
    newsUsed: news.count,
    clusterClubs: strat.clusterClubs,
    stackClub: strat.stackClub,
  };
}
