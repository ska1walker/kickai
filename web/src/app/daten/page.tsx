"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DEFAULT_SEASON } from "@/lib/data/squad";
import { loadPool, getActiveSeason, setActiveSeason } from "@/lib/data/loadPool";
import { supabaseEnabled } from "@/lib/supabase/client";

interface ImportResult {
  season: number;
  count: number;
  bridged?: number;
  unresolvedClubs: string[];
}

export default function DatenPage() {
  const [season, setSeason] = useState(DEFAULT_SEASON + 1);
  const [preseason, setPreseason] = useState(true);
  const [reference, setReference] = useState(DEFAULT_SEASON);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [active, setActive] = useState<number>(DEFAULT_SEASON);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActive(getActiveSeason());
    loadPool().then((n) => setActiveCount(n));
  }, []);

  async function runImport(payload: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/import-season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, preseason, reference, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setResult(json as ImportResult);
      setActiveSeason(season);
      const n = await loadPool(season);
      setActive(season);
      setActiveCount(n);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const csv = await file.text();
    await runImport({ source: "upload", csv });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Daten</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Saisondaten laden</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Neue kicker-Saisondaten in die App ziehen — ohne Redeploy. Der Kader-Aufbau
          und der Editor nutzen danach den geladenen Pool. Aktive Saison:{" "}
          <span className="font-mono text-ink">
            {active}/{(active + 1) % 100}
          </span>
          {activeCount != null && activeCount > 0 && <> · {activeCount} Spieler aus DB</>}
          {activeCount === 0 && <> · gebündelte Saison (kein Import)</>}.
        </p>
      </div>

      {!supabaseEnabled && (
        <div className="card p-4 text-sm text-ink-muted">
          Supabase ist nicht konfiguriert — der Import braucht die DB.
        </div>
      )}

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="label-caps block">Saison (Startjahr)</span>
            <input
              type="number"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="mt-1 w-28 rounded-md border border-ink-line px-3 py-2 font-mono outline-none focus:border-signal"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={preseason} onChange={(e) => setPreseason(e.target.checked)} />
            Vorsaison-Bridge (Saison noch ungespielt)
          </label>
          {preseason && (
            <label className="text-sm">
              <span className="label-caps block">Referenz</span>
              <input
                type="number"
                value={reference}
                onChange={(e) => setReference(Number(e.target.value))}
                className="mt-1 w-24 rounded-md border border-ink-line px-3 py-2 font-mono outline-none focus:border-signal"
              />
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => runImport({ source: "url" })}
            disabled={loading}
            className="btn-signal disabled:opacity-50"
          >
            {loading ? "Lade…" : "Von kicker ziehen (Archiv)"}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={loading} className="btn-ghost disabled:opacity-50">
            CSV hochladen
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onUpload} className="hidden" />
        </div>
        <p className="text-xs text-ink-muted">
          „Von kicker ziehen" holt die öffentliche Archiv-CSV (verfügbar, sobald die
          Saison läuft). Für die Vorsaison-Liste vor Saisonstart die CSV aus dem
          eingeloggten Managerspiel (Transfermarkt-Export) „hochladen".
        </p>

        {error && <p className="text-sm text-signal-700">{error}</p>}
        {result && (
          <div className="rounded-md border border-ink-line p-3 text-sm">
            <p>
              ✓ Saison {result.season}/{(result.season + 1) % 100} geladen:{" "}
              <strong>{result.count} Spieler</strong>
              {result.bridged != null && <> · {result.bridged} mit Vorsaison-Punkten (Bridge)</>}.
            </p>
            {result.unresolvedClubs.length > 0 && (
              <p className="mt-1 text-amber-800">
                ⚠ Unbekannte Vereine (in <code>clubs.ts</code>/<code>clubs.py</code> ergänzen, sonst
                fallen deren Spieler raus): {result.unresolvedClubs.join(", ")}
              </p>
            )}
            <p className="mt-2 text-ink-muted">
              Aktiv. Weiter zum{" "}
              <Link href="/aufbau" className="text-signal hover:underline">
                Kader-Aufbau
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
