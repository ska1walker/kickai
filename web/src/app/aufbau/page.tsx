"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { POOL } from "@/lib/data/pool";
import { CLUB_LABEL } from "@/lib/engine/clubs";
import { BUDGET } from "@/lib/engine/constraints";
import { buildProposal, type Proposal, type Tiers } from "@/lib/engine/builder";
import type { Position, SquadPlayer } from "@/lib/engine/types";
import { saveSquad } from "@/lib/squadStore";
import { loadNewsSignals, EMPTY_SIGNALS, norm, type NewsSignals } from "@/lib/newsSignals";
import type { StrategyInput, SetPieceRole } from "@/lib/engine/strategy";
import { loadPool, getActiveSeason } from "@/lib/data/loadPool";

const POS_LABEL: Record<Position, string> = {
  TW: "Torwart",
  ABW: "Abwehr",
  MF: "Mittelfeld",
  ST: "Sturm",
};
const ORDER: Position[] = ["TW", "ABW", "MF", "ST"];
const TIER_CHIP: Record<string, string> = {
  top: "bg-ink-line text-ink",
  surprise: "bg-signal text-white",
  mid: "bg-white text-ink-muted border border-ink-line",
  lower: "bg-white text-ink-muted border border-ink-line",
};
const TIER_SHORT: Record<string, string> = {
  top: "Spitze",
  surprise: "Überraschung",
  mid: "Mittelfeld",
  lower: "unten",
};
const SEC_CHIP: Record<string, string> = {
  hoch: "bg-signal-50 text-signal-700",
  mittel: "bg-white text-ink-muted border border-ink-line",
  rotation: "bg-amber-100 text-amber-900",
};

// Distinkte Vereins-Anzeigenamen aus dem AKTIVEN Pool (für die Recherche).
const distinctClubs = () => Array.from(new Set(POOL.map((p) => p.clubName))).sort();

export default function AufbauPage() {
  const [tiers, setTiers] = useState<Tiers>({});
  const [news, setNews] = useState<NewsSignals>(EMPTY_SIGNALS);
  const [stackDefense, setStackDefense] = useState(false);
  const [setPieceTakers, setSetPieceTakers] = useState<Record<string, SetPieceRole>>({});
  const [proposal, setProposal] = useState<Proposal>(() => buildProposal({}));
  const [tierLoading, setTierLoading] = useState(false);
  const [tierError, setTierError] = useState<string | null>(null);
  const [tierDone, setTierDone] = useState(false);
  const [spLoading, setSpLoading] = useState(false);
  const [spError, setSpError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const rebuild = (
    t: Tiers,
    n: NewsSignals,
    stack: boolean,
    sp: Record<string, SetPieceRole>,
  ) => {
    const strategy: StrategyInput = { stackDefense: stack, setPieceTakers: sp };
    setProposal(buildProposal(t, n, strategy));
  };

  // Aktiven Pool (importierte Saison) + News laden und den Vorschlag neu bauen.
  useEffect(() => {
    (async () => {
      await loadPool(getActiveSeason());
      const n = await loadNewsSignals();
      setNews(n);
      rebuild(tiers, n, stackDefense, setPieceTakers);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overBudget = proposal.totalMv > BUDGET + 1e-6;

  async function researchTiers() {
    setTierLoading(true);
    setTierError(null);
    try {
      const res = await fetch("/api/team-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubs: distinctClubs() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      const t = json.tiers as Tiers;
      setTiers(t);
      rebuild(t, news, stackDefense, setPieceTakers);
      setTierDone(true);
    } catch (e) {
      setTierError((e as Error).message);
    } finally {
      setTierLoading(false);
    }
  }

  function toggleStack() {
    const v = !stackDefense;
    setStackDefense(v);
    rebuild(tiers, news, v, setPieceTakers);
  }

  async function researchSetPieces() {
    setSpLoading(true);
    setSpError(null);
    try {
      const res = await fetch("/api/set-pieces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubs: distinctClubs() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      const map: Record<string, SetPieceRole> = {};
      (json.takers as { player: string; role: SetPieceRole }[]).forEach((t) => {
        map[norm(t.player)] = t.role;
      });
      setSetPieceTakers(map);
      rebuild(tiers, news, stackDefense, map);
    } catch (e) {
      setSpError((e as Error).message);
    } finally {
      setSpLoading(false);
    }
  }

  // Alternative in den Slot heben (lokaler Tausch).
  function swap(pos: Position, pickIdx: number, altIdx: number) {
    setProposal((prev) => {
      const next: Proposal = { ...prev, byPos: { ...prev.byPos } };
      const list = [...next.byPos[pos]];
      const pick = { ...list[pickIdx] };
      const alt = pick.alternatives[altIdx];
      if (!alt) return prev;
      const oldPlayer = pick.player;
      const oldReason = pick.reason;
      pick.player = alt.player;
      pick.reason = alt.reason;
      pick.alternatives = pick.alternatives.map((a, i) =>
        i === altIdx ? { player: oldPlayer, reason: oldReason } : a,
      );
      list[pickIdx] = pick;
      next.byPos[pos] = list;
      const flat = ORDER.flatMap((p) => next.byPos[p]);
      next.totalMv = Math.round(flat.reduce((s, x) => s + x.player.mv, 0) * 10) / 10;
      next.totalPoints = flat.reduce((s, x) => s + x.player.points, 0);
      return next;
    });
  }

  function applyProposal() {
    const squad: SquadPlayer[] = ORDER.flatMap((pos) =>
      proposal.byPos[pos].map((pk) => ({
        id: pk.player.id,
        name: pk.player.name,
        club: pk.player.club,
        position: pk.player.position,
        expPoints: pk.player.expPoints,
        mv: pk.player.mv,
      })),
    );
    saveSquad(squad).then(() =>
      setSavedMsg("Kader übernommen — im Kader-Editor verfeinerbar."),
    );
  }

  const surprises = useMemo(
    () => Object.entries(tiers).filter(([, v]) => v.tier === "surprise"),
    [tiers],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Kader-Aufbau</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Vorgeschlagener Kader
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Automatischer Vorschlag aus den Saisondaten: pro Slot eine
          Top-Empfehlung + zwei Alternativen, jeweils mit Begründung. Optional
          fließt eine Team-Tier-Analyse ein — günstige Spieler erwarteter
          Überraschungsteams werden bevorzugt.
        </p>
      </div>

      {/* Steuerung */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-caps">Budget des Vorschlags</p>
            <p className="mt-1 font-mono text-xl font-semibold">
              <span className={overBudget ? "text-signal" : ""}>
                {proposal.totalMv.toFixed(1)}
              </span>{" "}
              <span className="text-ink-muted">/ {BUDGET} Mio</span>
            </p>
            <p className="mt-1 text-sm">
              <span className="text-ink-muted">Erwartete Startelf: </span>
              <span className="font-mono font-semibold text-signal">
                {proposal.bestXiExp.toFixed(1)}
              </span>{" "}
              <span className="text-ink-muted">Pkt/Spieltag (beste aufstellbare Elf)</span>
            </p>
            <p className="text-xs text-ink-muted">
              Summe Kader-Basis: {proposal.totalPoints} Pkt (Vorsaison)
              {news.count > 0 && <> · {news.count} News-Signale einbezogen</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={researchTiers}
              disabled={tierLoading}
              className="btn-ghost disabled:opacity-50"
            >
              {tierLoading ? "Analysiere Teams…" : tierDone ? "Team-Tiers erneut" : "Team-Tiers analysieren"}
            </button>
            <button onClick={applyProposal} className="btn-signal">
              Diesen Kader übernehmen
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-line pt-3">
          <span className="label-caps">Ceiling-Plays</span>
          <button onClick={toggleStack} className={stackDefense ? "btn-signal" : "btn-ghost"}>
            {stackDefense ? "✓ Abwehr-Stack aktiv" : "Abwehr stacken"}
          </button>
          <button
            onClick={researchSetPieces}
            disabled={spLoading}
            className="btn-ghost disabled:opacity-50"
          >
            {spLoading
              ? "Suche Schützen…"
              : Object.keys(setPieceTakers).length
                ? "Schützen erneut"
                : "Standards/Elfmeter suchen"}
          </button>
          {Object.keys(setPieceTakers).length > 0 && (
            <span className="text-xs text-ink-muted">
              {Object.keys(setPieceTakers).length} Schützen erkannt
            </span>
          )}
        </div>
        {tierError && <p className="mt-2 text-sm text-signal-700">{tierError}</p>}
        {spError && <p className="mt-2 text-sm text-signal-700">{spError}</p>}
        {proposal.clusterClubs.length > 0 && (
          <p className="mt-2 text-xs text-ink-muted">
            Anker-Cluster (Vorsaison):{" "}
            <span className="text-ink">
              {proposal.clusterClubs
                .slice(0, 3)
                .map((c) => `${CLUB_LABEL[c.club] ?? c.club} (${c.anchors})`)
                .join(", ")}
            </span>{" "}
            — günstige Spieler dieser Teams höher gewichtet.
          </p>
        )}
        {proposal.stackClub && (
          <p className="mt-1 text-xs text-ink-muted">
            Stärkste Defensive:{" "}
            <span className="text-ink">{CLUB_LABEL[proposal.stackClub] ?? proposal.stackClub}</span>
            {stackDefense
              ? " — Torwart + Abwehr gestackt (korrelierte Zu-Null)"
              : " — über den Stack-Button korreliert setzbar"}
            .
          </p>
        )}
        {savedMsg && (
          <p className="mt-2 text-sm text-signal-700">
            {savedMsg}{" "}
            <Link href="/squad" className="underline">
              Zum Kader →
            </Link>
          </p>
        )}
        {surprises.length > 0 && (
          <p className="mt-2 text-xs text-ink-muted">
            Überraschungskandidaten oberes Drittel:{" "}
            <span className="text-ink">
              {surprises.map(([code]) => CLUB_LABEL[code] ?? code).join(", ")}
            </span>{" "}
            — ihre günstigen Spieler sind höher gewichtet.
          </p>
        )}
      </div>

      {/* Positionsgruppen */}
      {ORDER.map((pos) => (
        <section key={pos}>
          <h2 className="label-caps mb-2">{POS_LABEL[pos]}</h2>
          <div className="space-y-2">
            {proposal.byPos[pos].map((pk, i) => {
              const t = tiers[pk.player.club]?.tier;
              return (
                <div key={pk.player.id} className="card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {pk.player.name}
                        {pk.role === "filler" && (
                          <span className="ml-2 text-xs text-ink-muted">(Bank)</span>
                        )}
                        {t && (
                          <span className={`chip ml-2 text-[10px] ${TIER_CHIP[t]}`}>
                            {TIER_SHORT[t]}
                          </span>
                        )}
                        {pk.role === "premium" && pk.security && pk.security.label !== "unklar" && (
                          <span className={`chip ml-2 text-[10px] ${SEC_CHIP[pk.security.label]}`}>
                            Stammplatz {pk.security.label}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted" title={pk.reason}>
                        {pk.reason}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-ink-muted">
                      {pk.player.mv.toFixed(1)}M · {pk.player.points}P
                    </span>
                  </div>

                  {pk.alternatives.length > 0 && (
                    <div className="mt-2 border-t border-ink-line pt-2">
                      <p className="label-caps mb-1">Alternativen</p>
                      <ul className="space-y-1">
                        {pk.alternatives.map((a, j) => (
                          <li key={a.player.id} className="flex items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate">
                              <span className="font-medium">{a.player.name}</span>{" "}
                              <span className="text-xs text-ink-muted" title={a.reason}>
                                — {a.reason}
                              </span>
                            </span>
                            <button
                              onClick={() => swap(pos, i, j)}
                              className="shrink-0 text-sm text-signal hover:underline"
                            >
                              wählen
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap gap-3">
        <button onClick={applyProposal} className="btn-signal">
          Diesen Kader übernehmen
        </button>
        <Link href="/squad" className="btn-ghost">
          Zum Editor
        </Link>
      </div>
    </div>
  );
}
