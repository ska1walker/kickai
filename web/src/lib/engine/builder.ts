// Kader-Vorschlags-Engine (deterministisch, erklärbar).
// Baut aus dem Spieler-Pool einen budget- und strukturkonformen Kader:
// pro Slot eine Top-Empfehlung + 2 Alternativen, jeweils mit Begründung.
//
// Leitidee (aus der Datenanalyse): Effizienz-Anker — viel Output pro Euro,
// bevorzugt defensive Dauerläufer. Zusätzlich fließen ein:
//  - Team-Tier-Erwartung (günstige Spieler erwarteter Überraschungsteams),
//  - News-Memory (Ab-/Zugänge, Verletzungen, Vorbereitung, Transferstärke),
//    jeweils recency-gewichtet.
import { POOL, type PoolPlayer } from "@/lib/data/pool";
import { BUDGET, SQUAD_SHAPE } from "./constraints";
import type { Position } from "./types";
import { playerNews, EMPTY_SIGNALS, type NewsSignals } from "@/lib/newsSignals";

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
}
export interface Proposal {
  byPos: Record<Position, Pick[]>;
  totalMv: number;
  totalPoints: number;
  newsUsed: number;
}

const ORDER: Position[] = ["TW", "ABW", "MF", "ST"];
const PREMIUM: Record<Position, number> = { TW: 1, ABW: 4, MF: 4, ST: 3 };
const POS_WEIGHT: Record<Position, number> = { TW: 0.9, ABW: 1.05, MF: 1.05, ST: 1.0 };
const TIER_BONUS: Record<Tier, number> = { top: 0.05, surprise: 0.15, mid: 0, lower: -0.1 };
const TIER_LABEL: Record<Tier, string> = {
  top: "Spitzenteam",
  surprise: "Überraschungskandidat oberes Drittel",
  mid: "Mittelfeld",
  lower: "unteres Drittel",
};

const ppm = (p: PoolPlayer) => p.points / Math.max(p.mv, 0.5);

// Vorberechnete News-Deltas + Notizen je Spieler-ID (Namens-Matching einmalig).
type NewsMap = Map<string, { delta: number; notes: string[] }>;

function adj(p: PoolPlayer, tiers: Tiers, news: NewsSignals, nm: NewsMap): number {
  const bonus = tiers[p.club]?.tier ? TIER_BONUS[tiers[p.club].tier] : 0;
  const clubDelta = news.byClub[p.club]?.delta ?? 0;
  const playerDelta = nm.get(p.id!)?.delta ?? 0;
  return p.points * POS_WEIGHT[p.position] * (1 + bonus) * (1 + clubDelta + playerDelta);
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
function histNote(p: PoolPlayer): string {
  return p.hasHistory === false ? " · kein Vorsaison-Wert (Einschätzung via Scout/News)" : "";
}

function premiumReason(p: PoolPlayer, tiers: Tiers, news: NewsSignals, nm: NewsMap): string {
  return `${p.points} Pkt bei ${p.mv.toFixed(1)}M (${ppm(p).toFixed(0)} P/Mio) · ${p.clubName}${tierNote(p, tiers)}${newsNote(p, news, nm)}${histNote(p)}`;
}
function fillerReason(p: PoolPlayer, news: NewsSignals, nm: NewsMap): string {
  return `Günstiger Bankplatz (${p.mv.toFixed(1)}M) · ${p.clubName} — spart Budget für die Startelf${newsNote(p, news, nm)}`;
}
function altReason(p: PoolPlayer, tiers: Tiers, news: NewsSignals, nm: NewsMap): string {
  return `${p.points} Pkt / ${p.mv.toFixed(1)}M${tierNote(p, tiers)}${newsNote(p, news, nm)}${histNote(p)}`;
}

export function buildProposal(tiers: Tiers = {}, news: NewsSignals = EMPTY_SIGNALS): Proposal {
  const valid = POOL.filter((p) => p.mv > 0 && p.mv < 100 && p.club !== "?");
  // News-Deltas/Notizen je Spieler einmal vorberechnen.
  const nm: NewsMap = new Map();
  if (news.count) for (const p of valid) nm.set(p.id!, playerNews(p.name, news));

  const byPosPool: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };
  for (const p of valid) byPosPool[p.position].push(p);

  const selected = new Set<string>();
  const premiumByPos: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };
  const fillerByPos: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };
  const A = (p: PoolPlayer) => adj(p, tiers, news, nm);

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

    for (const p of premiumByPos[pos]) {
      byPos[pos].push({
        player: p,
        role: "premium",
        reason: premiumReason(p, tiers, news, nm),
        alternatives: premAlts
          .filter((a) => a.mv <= p.mv * 1.2)
          .slice(0, 2)
          .map((a) => ({ player: a, reason: altReason(a, tiers, news, nm) })),
      });
    }
    for (const p of fillerByPos[pos]) {
      byPos[pos].push({
        player: p,
        role: "filler",
        reason: fillerReason(p, news, nm),
        alternatives: cheapAlts.slice(0, 2).map((a) => ({ player: a, reason: altReason(a, tiers, news, nm) })),
      });
    }
  }

  const flat = ORDER.flatMap((pos) => byPos[pos]);
  return {
    byPos,
    totalMv: Math.round(flat.reduce((s, p) => s + p.player.mv, 0) * 10) / 10,
    totalPoints: flat.reduce((s, p) => s + p.player.points, 0),
    newsUsed: news.count,
  };
}
