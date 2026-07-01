"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_SEASON } from "@/lib/data/squad";
import { loadSquad } from "@/lib/squadStore";
import { CLUB_LABEL } from "@/lib/engine/clubs";
import {
  joinFixtures,
  optimize,
  opponentLabel,
  PlayerState,
} from "@/lib/engine/optimizer";
import type { Fixture, Position, Status, SquadPlayer } from "@/lib/engine/types";
import { STATUS_LABEL } from "@/lib/engine/types";
import {
  loadStatusWithCarryover,
  saveStatus,
  type StatusMap,
} from "@/lib/store";
import { supabaseEnabled } from "@/lib/supabase/client";

const STATUSES: Status[] = ["start", "doubt", "bench", "out"];
const STATUS_STYLE: Record<Status, string> = {
  start: "bg-signal text-white border-signal",
  doubt: "bg-amber-100 text-amber-900 border-amber-300",
  bench: "bg-ink-line text-ink border-ink-line",
  out: "bg-white text-ink-muted border-ink-line",
};
const POS_ORDER: Record<Position, number> = { TW: 0, ABW: 1, MF: 2, ST: 3 };

function fmtKickoff(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  return `${wd} ${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MatchdayPage() {
  const [season] = useState(DEFAULT_SEASON);
  const [matchday, setMatchday] = useState(1);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [statusById, setStatusById] = useState<StatusMap>({});
  const [carriedFrom, setCarriedFrom] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSquad().then(setSquad);
  }, []);

  // id ↔ name Brücke (Engine keyt nach Name, Speicher nach id)
  const idByName = useMemo(
    () => Object.fromEntries(squad.map((p) => [p.name, p.id ?? p.name])),
    [squad],
  );

  const fetchFixtures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matchday?season=${season}&matchday=${matchday}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setFixtures(json.fixtures as Fixture[]);
    } catch (e) {
      setError((e as Error).message);
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [season, matchday]);

  useEffect(() => {
    fetchFixtures();
    loadStatusWithCarryover(season, matchday).then(({ map, carriedFrom }) => {
      setStatusById(map);
      setCarriedFrom(carriedFrom);
    });
  }, [season, matchday, fetchFixtures]);

  // Engine-Statusmap nach Name
  const statusByName: Record<string, Status> = useMemo(() => {
    const m: Record<string, Status> = {};
    for (const p of squad) {
      const id = p.id ?? p.name;
      if (statusById[id]) m[p.name] = statusById[id];
    }
    return m;
  }, [squad, statusById]);

  const joined: PlayerState[] = useMemo(
    () => (fixtures && squad.length ? joinFixtures(squad, fixtures, statusByName) : []),
    [squad, fixtures, statusByName],
  );

  const result = useMemo(() => (joined.length ? optimize(joined) : null), [joined]);
  const lineupNames = useMemo(
    () => new Set(result && "lineup" in result ? result.lineup.map((p) => p.name) : []),
    [result],
  );

  function setStatus(name: string, status: Status) {
    const id = idByName[name];
    const next = { ...statusById, [id]: status };
    setStatusById(next);
    setCarriedFrom(null);
    saveStatus(season, matchday, next);
  }

  const byPos = useMemo(() => {
    return [...joined].sort(
      (a, b) =>
        POS_ORDER[a.position] - POS_ORDER[b.position] || b.expPoints - a.expPoints,
    );
  }, [joined]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">
            Saison {season}/{(season + 1) % 100} · Live-Spielplan OpenLigaDB
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Spieltag {matchday}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost"
            onClick={() => setMatchday((m) => Math.max(1, m - 1))}
          >
            ←
          </button>
          <select
            className="btn-ghost font-mono"
            value={matchday}
            onChange={(e) => setMatchday(Number(e.target.value))}
          >
            {Array.from({ length: 34 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                ST {m}
              </option>
            ))}
          </select>
          <button
            className="btn-ghost"
            onClick={() => setMatchday((m) => Math.min(34, m + 1))}
          >
            →
          </button>
        </div>
      </div>

      <p className="text-xs text-ink-muted">
        {supabaseEnabled ? "Persistenz: Supabase" : "Persistenz: lokal im Browser"}
        {carriedFrom ? ` · Status aus ST ${carriedFrom} übernommen — nur Änderungen pflegen` : ""}
      </p>

      {error && (
        <div className="card border-signal p-3 text-sm text-signal-700">
          Spielplan-Abruf: {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Status-Editor */}
        <section>
          <h2 className="label-caps mb-2">Status pflegen</h2>
          <div className="card divide-y divide-ink-line">
            {loading && <p className="p-4 text-sm text-ink-muted">Lade Spielplan…</p>}
            {!loading &&
              byPos.map((p) => {
                const noGame = !p.fixture;
                const inXI = lineupNames.has(p.name);
                return (
                  <div
                    key={p.name}
                    className={`flex items-center gap-3 px-4 py-2.5 ${inXI ? "bg-signal-50" : ""}`}
                  >
                    <span className="w-8 font-mono text-xs text-ink-muted">
                      {p.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {p.name}
                        {inXI && <span className="ml-1 text-signal">●</span>}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {noGame
                          ? `${CLUB_LABEL[p.club] ?? p.club} · kein Spiel`
                          : `${opponentLabel(p)} · ${fmtKickoff(p.fixture!.kickoff)}`}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-ink-muted">
                      ~{p.expPoints.toFixed(1)}
                    </span>
                    <div className="flex gap-1">
                      {STATUSES.map((s) => {
                        const active = p.status === s;
                        const disabled = noGame && s !== "out";
                        return (
                          <button
                            key={s}
                            disabled={disabled}
                            onClick={() => setStatus(p.name, s)}
                            title={STATUS_LABEL[s]}
                            className={`h-7 w-8 rounded border text-xs font-medium transition
                              ${active ? STATUS_STYLE[s] : "border-ink-line bg-paper text-ink-muted hover:bg-canvas"}
                              ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                          >
                            {s[0].toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            S = start · D = fraglich · B = Bank · O = raus. Änderungen werden sofort gespeichert.
          </p>
        </section>

        {/* Empfohlene Elf */}
        <aside className="space-y-4">
          <div className="card p-4">
            <h2 className="label-caps">Empfohlene Elf</h2>
            {result && "error" in result && (
              <p className="mt-2 text-sm text-signal-700">{result.error}</p>
            )}
            {result && "lineup" in result && (
              <>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-mono text-xl font-semibold">{result.formation}</span>
                  <span className="text-sm text-ink-muted">
                    <span className="font-mono text-signal text-lg font-semibold">
                      {result.expectedPoints}
                    </span>{" "}
                    Pkt erwartet
                  </span>
                </div>
                <ul className="mt-3 space-y-1">
                  {result.lineup
                    .slice()
                    .sort((a, b) => POS_ORDER[a.position] - POS_ORDER[b.position])
                    .map((p) => (
                      <li key={p.name} className="flex items-center gap-2 text-sm">
                        <span className="w-8 font-mono text-xs text-ink-muted">
                          {p.position}
                        </span>
                        <span className="flex-1 truncate">{p.name}</span>
                        <span
                          className={`chip ${p.status === "start" ? "text-signal" : "text-amber-700"}`}
                        >
                          {STATUS_LABEL[p.status]}
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </div>

          {/* Timeline nach Anstoß */}
          {result && "lineup" in result && (
            <div className="card p-4">
              <h2 className="label-caps">Deadline-Timeline</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {result.lineup
                  .filter((p) => p.kickoff)
                  .sort((a, b) => (a.kickoff! < b.kickoff! ? -1 : 1))
                  .map((p) => (
                    <li key={p.name} className="flex items-center gap-2">
                      <span className="w-28 font-mono text-xs text-ink-muted">
                        {fmtKickoff(p.kickoff)}
                      </span>
                      <span className="flex-1 truncate">{p.name}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Warnungen */}
          {result && "warnings" in result && result.warnings.length > 0 && (
            <div className="card border-amber-300 bg-amber-50 p-4">
              <h2 className="label-caps text-amber-800">Hinweise</h2>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-amber-900">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
