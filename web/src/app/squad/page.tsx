"use client";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SEASON } from "@/lib/data/squad";
import { CLUB_LABEL } from "@/lib/engine/clubs";
import { checkSquad, SQUAD_SHAPE, BUDGET } from "@/lib/engine/constraints";
import type { Position, SquadPlayer } from "@/lib/engine/types";
import { loadSquad, saveSquad, resetSquad } from "@/lib/squadStore";
import { searchPool, type PoolPlayer } from "@/lib/data/pool";
import { supabaseEnabled } from "@/lib/supabase/client";

const POS_LABEL: Record<Position, string> = {
  TW: "Torwart",
  ABW: "Abwehr",
  MF: "Mittelfeld",
  ST: "Sturm",
};
const ORDER: Position[] = ["TW", "ABW", "MF", "ST"];

export default function SquadPage() {
  const [squad, setSquad] = useState<SquadPlayer[] | null>(null);
  const [addFor, setAddFor] = useState<Position | null>(null);
  const [query, setQuery] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    loadSquad().then(setSquad);
  }, []);

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
              {players.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-ink-muted">{CLUB_LABEL[p.club] ?? p.club}</p>
                  </div>
                  <div className="flex items-center gap-4">
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
              ))}
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
