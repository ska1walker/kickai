// Kader-Vorschlags-Engine (deterministisch, erklärbar).
// Baut aus dem Spieler-Pool einen budget- und strukturkonformen Kader:
// pro Slot eine Top-Empfehlung + 2 Alternativen, jeweils mit Begründung.
//
// Leitidee (aus der Datenanalyse): Effizienz-Anker — viel Output pro Euro,
// bevorzugt defensive Dauerläufer. Zusätzlich fließt die Team-Tier-Erwartung
// ein: günstige Spieler von erwarteten Überraschungsteams sind unterbewertet.
import { POOL, type PoolPlayer } from "@/lib/data/pool";
import { BUDGET, SQUAD_SHAPE } from "./constraints";
import type { Position } from "./types";

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

function adj(p: PoolPlayer, tiers: Tiers): number {
  const t = tiers[p.club]?.tier;
  const bonus = t ? TIER_BONUS[t] : 0;
  return p.points * POS_WEIGHT[p.position] * (1 + bonus);
}
const ppm = (p: PoolPlayer) => p.points / Math.max(p.mv, 0.5);

function tierNote(p: PoolPlayer, tiers: Tiers): string {
  const info = tiers[p.club];
  if (!info) return "";
  const base = ` · ${TIER_LABEL[info.tier]}`;
  return info.reason ? `${base}: ${info.reason}` : base;
}

function premiumReason(p: PoolPlayer, tiers: Tiers): string {
  return `${p.points} Pkt bei ${p.mv.toFixed(1)}M (${ppm(p).toFixed(0)} P/Mio) · ${p.clubName}${tierNote(p, tiers)}`;
}
function fillerReason(p: PoolPlayer): string {
  return `Günstiger Bankplatz (${p.mv.toFixed(1)}M) · ${p.clubName} — spart Budget für die Startelf`;
}
function altReason(p: PoolPlayer, tiers: Tiers): string {
  return `${p.points} Pkt / ${p.mv.toFixed(1)}M${tierNote(p, tiers)}`;
}

export function buildProposal(tiers: Tiers = {}): Proposal {
  const valid = POOL.filter((p) => p.mv > 0 && p.mv < 100 && p.club !== "?");
  const byPosPool: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };
  for (const p of valid) byPosPool[p.position].push(p);

  const selected = new Set<string>();
  const premiumByPos: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };
  const fillerByPos: Record<Position, PoolPlayer[]> = { TW: [], ABW: [], MF: [], ST: [] };

  for (const pos of ORDER) {
    const ranked = [...byPosPool[pos]].sort((a, b) => adj(b, tiers) - adj(a, tiers));
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
        if (p.mv <= 0.5) return; // nicht weiter reduzierbar
        const eff = adj(p, tiers) / p.mv;
        if (!worst || eff < adj(worst.p, tiers) / worst.p.mv) worst = { pos, idx, p };
      });
    }
    if (!worst) break;
    const w = worst as { pos: Position; idx: number; p: PoolPlayer };
    const replacement = [...byPosPool[w.pos]]
      .filter((c) => !selected.has(c.id!) && c.mv < w.p.mv)
      .sort((a, b) => adj(b, tiers) - adj(a, tiers))[0];
    if (!replacement) {
      // nichts Billigeres frei → diesen Pick fixieren, nächst-teuren versuchen
      const eff = adj(w.p, tiers) / w.p.mv;
      const stuck = ORDER.every((pos) =>
        premiumByPos[pos].every(
          (p) => p.mv <= 0.5 || adj(p, tiers) / p.mv >= eff,
        ),
      );
      if (stuck) break;
      selected.delete(w.p.id!); // markieren, dann neu — Vereinfachung: abbrechen
      selected.add(w.p.id!);
      break;
    }
    selected.delete(w.p.id!);
    selected.add(replacement.id!);
    premiumByPos[w.pos][w.idx] = replacement;
  }

  // Ergebnis + Alternativen zusammenstellen.
  const byPos: Record<Position, Pick[]> = { TW: [], ABW: [], MF: [], ST: [] };
  for (const pos of ORDER) {
    const premAlts = [...byPosPool[pos]]
      .filter((p) => !selected.has(p.id!))
      .sort((a, b) => adj(b, tiers) - adj(a, tiers));
    const cheapAlts = [...byPosPool[pos]]
      .filter((p) => !selected.has(p.id!))
      .sort((a, b) => a.mv - b.mv);

    for (const p of premiumByPos[pos]) {
      byPos[pos].push({
        player: p,
        role: "premium",
        reason: premiumReason(p, tiers),
        alternatives: premAlts
          .filter((a) => a.mv <= p.mv * 1.2)
          .slice(0, 2)
          .map((a) => ({ player: a, reason: altReason(a, tiers) })),
      });
    }
    for (const p of fillerByPos[pos]) {
      byPos[pos].push({
        player: p,
        role: "filler",
        reason: fillerReason(p),
        alternatives: cheapAlts.slice(0, 2).map((a) => ({ player: a, reason: altReason(a, tiers) })),
      });
    }
  }

  const flat = ORDER.flatMap((pos) => byPos[pos]);
  return {
    byPos,
    totalMv: Math.round(flat.reduce((s, p) => s + p.player.mv, 0) * 10) / 10,
    totalPoints: flat.reduce((s, p) => s + p.player.points, 0),
  };
}
