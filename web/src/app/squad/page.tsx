"use client";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SEASON } from "@/lib/data/squad";
import { CLUB_LABEL } from "@/lib/engine/clubs";
import { checkSquad, SQUAD_SHAPE, BUDGET } from "@/lib/engine/constraints";
import type { Position, SquadPlayer } from "@/lib/engine/types";
import { loadSquad, saveSquad, resetSquad } from "@/lib/squadStore";
import { searchPool, poolById, type PoolPlayer } from "@/lib/data/pool";
import { loadPool, getActiveSeason } from "@/lib/data/loadPool";
import { supabaseEnabled } from "@/lib/supabase/client";
import { explainPlayer, explainScore, type Tiers } from "@/lib/engine/builder";
import { ScoreTrace } from "@/components/ScoreTrace";
import { computeSecurity } from "@/lib/engine/security";
import { loadNewsSignals, EMPTY_SIGNALS, type NewsSignals } from "@/lib/newsSignals";
import { loadStoredTiers } from "@/lib/research";

const POS_LABEL: Record<Position, string> = {
  TW: "Torwart",
  ABW: "Abwehr",
  MF: "Mittelfeld",
  ST: "Sturm",
};
const ORDER: Position[] = ["TW", "ABW", "MF", "ST"];

type Scout = { signal: "hoch" | "mittel" | "niedrig" | "unklar"; tags: string[]; note: string };
const SIGNAL_STYLE: Record<Scout["signal"], string> = {
  hoch: "bg-signal text-white border-signal",
  mittel: "bg-amber-100 text-amber-900 border-amber-300",
  niedrig: "bg-ink-line text-ink border-ink-line",
  unklar: "bg-white text-ink-muted border-ink-line",
};

export default function SquadPage() {
  const [squad, setSquad] = useState<SquadPlayer[] | null>(null);
  const [addFor, setAddFor] = useState<Position | null>(null);
  const [query, setQuery] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Talent-Scout (Vorbereitung, U21, Fritz-Walter)
  const [scoutOpen, setScoutOpen] = useState(false);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [scoutByName, setScoutByName] = useState<Record<string, Scout>>({});

  // Begründungs-Kontext: News-Signale + gespeicherte Team-Tier-Recherche.
  const [news, setNews] = useState<NewsSignals>(EMPTY_SIGNALS);
  const [tiers, setTiers] = useState<Tiers>({});

  useEffect(() => {
    loadPool(getActiveSeason()).finally(() => loadSquad().then(setSquad));
    loadNewsSignals().then(setNews);
    setTiers(loadStoredTiers());
  }, []);

  // Warum steht der Spieler im Kader? Vorsaison-Basis, Tier, News, Historie —
  // dynamisch berechnet, damit es auch für manuell ergänzte Spieler stimmt.
  function explain(p: SquadPlayer): string | null {
    const pool = p.id ? poolById(p.id) : undefined;
    return pool ? explainPlayer(pool, tiers, news) : null;
  }

  // Einsatzsicherheit einmal für den ganzen Pool (teuer je Aufruf).
  const security = useMemo(() => computeSecurity(), [squad]);
  function trace(p: SquadPlayer) {
    const pool = p.id ? poolById(p.id) : undefined;
    return pool ? explainScore(pool, tiers, news, undefined, security) : null;
  }

  const check = useMemo(() => (squad ? checkSquad(squad) : null), [squad]);
  const ids = useMemo(() => new Set((squad ?? []).map((p) => p.id)), [squad]);

  function persist(next: SquadPlayer[]) {
    setSquad(next);
    saveSquad(next).then(() => setSavedAt(new Date().toLocaleTimeString("de-DE")));
  }

  function removePlayer(id?: string) {
    if (!squad) return;
    persist(squad.filter((p) => p.id !== id));
  }

  function addPlayer(p: PoolPlayer) {
    if (!squad || ids.has(p.id)) return;
    persist([
      ...squad,
      { id: p.id, name: p.name, club: p.club, position: p.position, expPoints: p.expPoints, mv: p.mv },
    ]);
    setQuery("");
    setAddFor(null);
  }

  const suggestions = useMemo(
    () => (addFor ? searchPool(query, addFor).filter((p) => !ids.has(p.id)) : []),
    [addFor, query, ids],
  );

  async function runScout(list: SquadPlayer[]) {
    if (!list.length) return;
    setScoutLoading(true);
    setScoutError(null);
    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: list.map((p) => ({
            name: p.name,
            club: CLUB_LABEL[p.club] ?? p.club,
            position: p.position,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      const next: Record<string, Scout> = { ...scoutByName };
      (json.players as (Scout & { name: string })[]).forEach((r) => {
        next[r.name] = { signal: r.signal, tags: r.tags, note: r.note };
      });
      setScoutByName(next);
    } catch (e) {
      setScoutError((e as Error).message);
    } finally {
      setScoutLoading(false);
    }
  }

  if (!squad || !check) {
    return <p className="text-sm text-ink-muted">Lade Kader…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">
            Kader-Editor · Referenz-Saison {DEFAULT_SEASON}/{(DEFAULT_SEASON + 1) % 100}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {squad.length} / 22 Spieler
          </h1>
        </div>
        <button
          className="btn-ghost"
          onClick={async () => {
            await resetSquad();
            const s = await loadSquad();
            setSquad(s);
            setSavedAt(new Date().toLocaleTimeString("de-DE"));
          }}
        >
          Auf Standard zurücksetzen
        </button>
      </div>

      {/* Budget & Struktur */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-caps">Budget</p>
            <p className="mt-1 font-mono text-xl font-semibold">
              <span className={check.totalMv > BUDGET ? "text-signal" : ""}>
                {check.totalMv.toFixed(1)}
              </span>{" "}
              <span className="text-ink-muted">/ {BUDGET} Mio</span>
            </p>
            <p className={`text-sm ${check.budgetLeft < 0 ? "text-signal" : "text-ink-muted"}`}>
              {check.budgetLeft >= 0
                ? `${check.budgetLeft.toFixed(1)} Mio frei`
                : `${Math.abs(check.budgetLeft).toFixed(1)} Mio drüber`}
            </p>
          </div>
          <div className="flex gap-4">
            {ORDER.map((pos) => {
              const ok = check.counts[pos] === SQUAD_SHAPE[pos];
              return (
                <div key={pos} className="text-center">
                  <p className="label-caps">{pos}</p>
                  <p className={`mt-1 font-mono text-lg ${ok ? "" : "text-signal"}`}>
                    {check.counts[pos]}
                    <span className="text-xs text-ink-muted">/{SQUAD_SHAPE[pos]}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <div className="text-right">
            <span
              className={`chip ${check.valid ? "bg-signal-50 text-signal-700" : "bg-amber-100 text-amber-800"}`}
            >
              {check.valid ? "✓ gültiger Kader" : "unvollständig"}
            </span>
            <p className="mt-1 text-xs text-ink-muted">
              {savedAt ? `gespeichert ${savedAt}` : ""}{" "}
              {supabaseEnabled ? "· Supabase" : "· lokal"}
            </p>
          </div>
        </div>
        {check.issues.length > 0 && (
          <p className="mt-3 text-sm text-amber-800">{check.issues.join(" · ")}</p>
        )}
      </div>

      {/* Talent-Scout */}
      <div className="card p-4">
        <button
          onClick={() => setScoutOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="label-caps">Talent-Scout</span>
            <span className="ml-2 text-sm font-medium">
              Vorbereitung · U21 · Fritz-Walter-Medaille
            </span>
          </span>
          <span className="text-ink-muted">{scoutOpen ? "−" : "+"}</span>
        </button>

        {scoutOpen && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-ink-muted">
              Die KI recherchiert pro Spieler Signale, die der Marktwert nicht abbildet
              — Form in der Sommer-Vorbereitung, U21-/A-Nominierung, Fritz-Walter-Medaille,
              erwartete Rolle — und leitet ein Durchbruch-/Stammplatz-Signal ab. Ideal für
              die günstigen Anker-Kandidaten. Erscheint als Marker an jedem Spieler.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => runScout(squad.filter((p) => (p.mv ?? 0) <= 3))}
                disabled={scoutLoading}
                className="btn-signal disabled:opacity-50"
              >
                {scoutLoading ? "Scoutet…" : "Günstige scouten (≤3 Mio)"}
              </button>
              <button
                onClick={() => runScout(squad)}
                disabled={scoutLoading}
                className="btn-ghost disabled:opacity-50"
              >
                Ganzen Kader scouten
              </button>
              {Object.keys(scoutByName).length > 0 && (
                <span className="text-xs text-ink-muted">
                  {Object.keys(scoutByName).length} Spieler gescoutet
                </span>
              )}
            </div>
            {scoutError && <p className="text-sm text-signal-700">{scoutError}</p>}
            <p className="text-xs text-ink-muted">
              Die Recherche kann bei vielen Spielern ~1 Minute dauern.
            </p>
          </div>
        )}
      </div>

      {/* Positionsgruppen */}
      {ORDER.map((pos) => {
        const players = squad
          .filter((p) => p.position === pos)
          .sort((a, b) => b.expPoints - a.expPoints);
        const full = players.length >= SQUAD_SHAPE[pos];
        return (
          <section key={pos}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="label-caps">
                {POS_LABEL[pos]} · {players.length}/{SQUAD_SHAPE[pos]}
              </h2>
              <button
                className="text-sm text-signal hover:underline"
                onClick={() => {
                  setAddFor(addFor === pos ? null : pos);
                  setQuery("");
                }}
              >
                {addFor === pos ? "Abbrechen" : "+ Spieler"}
              </button>
            </div>

            {addFor === pos && (
              <div className="card mb-2 p-3">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`${POS_LABEL[pos]} suchen (Name oder Verein)…`}
                  className="w-full rounded-md border border-ink-line px-3 py-2 text-sm outline-none focus:border-signal"
                />
                <ul className="mt-2 max-h-64 divide-y divide-ink-line overflow-auto">
                  {suggestions.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => addPlayer(p)}
                        className="flex w-full items-center justify-between px-1 py-2 text-left hover:bg-canvas"
                      >
                        <span>
                          <span className="font-medium">{p.name}</span>{" "}
                          <span className="text-xs text-ink-muted">
                            {CLUB_LABEL[p.club] ?? p.clubName}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-ink-muted">
                          {p.mv.toFixed(1)}M · ~{p.expPoints.toFixed(1)} · {p.points}P
                        </span>
                      </button>
                    </li>
                  ))}
                  {suggestions.length === 0 && (
                    <li className="px-1 py-2 text-sm text-ink-muted">Kein Treffer.</li>
                  )}
                </ul>
                {full && (
                  <p className="mt-1 text-xs text-amber-700">
                    Position ist voll ({SQUAD_SHAPE[pos]}) — erst einen entfernen.
                  </p>
                )}
              </div>
            )}

            <div className="card divide-y divide-ink-line">
              {players.map((p) => {
                const sc = scoutByName[p.name];
                const why = explain(p);
                const bd = trace(p);
                return (
                <div key={p.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.name}
                      {sc && (
                        <span
                          className={`chip ml-2 border align-middle text-[10px] ${SIGNAL_STYLE[sc.signal]}`}
                          title={sc.note}
                        >
                          {sc.signal}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-muted">{CLUB_LABEL[p.club] ?? p.club}</p>
                    {why && (
                      <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-muted">
                        {why}
                      </p>
                    )}
                    {sc && (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {sc.tags.length > 0 && (
                          <span className="font-medium text-ink">{sc.tags.join(" · ")} — </span>
                        )}
                        {sc.note}
                      </p>
                    )}
                    {bd && <ScoreTrace bd={bd} />}
                  </div>
                  <div className="flex shrink-0 items-center gap-4 pt-0.5">
                    <span className="font-mono text-xs text-ink-muted">
                      {(p.mv ?? 0).toFixed(1)}M · ~{p.expPoints.toFixed(1)}
                    </span>
                    <button
                      onClick={() => removePlayer(p.id)}
                      className="text-ink-muted hover:text-signal"
                      title="Entfernen"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                );
              })}
              {players.length === 0 && (
                <p className="px-4 py-3 text-sm text-ink-muted">Noch keiner.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
