// Quellen-Verwaltung: welche Domains die KI-Recherchen durchsuchen dürfen.
// Die Liste geht als harte Whitelist an die Websuche — was hier fehlt, wird
// technisch nicht gelesen.
"use client";
import { useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import { DEFAULT_SOURCES, normalizeDomain, type NewsSource } from "@/lib/sources";

export default function QuellenPage() {
  const [rows, setRows] = useState<NewsSource[] | null>(null);
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (!supabaseEnabled || !supabase) {
      setRows([]);
      return;
    }
    const { data, error } = await supabase
      .from("news_sources")
      .select("domain,active,note")
      .order("domain");
    if (error) setError(error.message);
    setRows((data as NewsSource[]) ?? []);
  }
  useEffect(() => {
    reload();
  }, []);

  async function add() {
    const d = normalizeDomain(domain);
    if (!d || !d.includes(".")) {
      setError("Bitte eine Domain angeben, z. B. kicker.de");
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("news_sources")
      .upsert({ domain: d, active: true, note: note.trim() || null });
    if (error) setError(error.message);
    setDomain("");
    setNote("");
    await reload();
    setBusy(false);
  }

  async function toggle(r: NewsSource) {
    if (!supabase) return;
    setBusy(true);
    await supabase.from("news_sources").update({ active: !r.active }).eq("domain", r.domain);
    await reload();
    setBusy(false);
  }

  async function remove(r: NewsSource) {
    if (!supabase) return;
    setBusy(true);
    await supabase.from("news_sources").delete().eq("domain", r.domain);
    await reload();
    setBusy(false);
  }

  async function seedDefaults() {
    if (!supabase) return;
    setBusy(true);
    await supabase.from("news_sources").upsert(
      DEFAULT_SOURCES.map((d) => ({ domain: d, active: true, note: "Standardquelle" })),
    );
    await reload();
    setBusy(false);
  }

  const active = (rows ?? []).filter((r) => r.active);
  const usingDefaults = active.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Recherche</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">News-Quellen</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Diese Domains darf die KI durchsuchen — beim täglichen News-Sammler,
          beim Talent-Scout, bei der Team-Tier-Analyse, bei den Standardschützen
          und bei den Spieltags-Vorschlägen. Es ist eine{" "}
          <strong className="text-ink">harte Whitelist</strong>: Was hier nicht
          steht, wird technisch nicht gelesen. Ist die Liste leer, gilt die
          eingebaute Standardliste.
        </p>
      </div>

      {!supabaseEnabled && (
        <div className="card p-4 text-sm text-ink-muted">
          Ohne Supabase lassen sich keine eigenen Quellen speichern — es gilt die
          Standardliste.
        </div>
      )}
      {error && (
        <div className="card border-signal p-3 text-sm text-signal-700">
          Fehler: {error}. Ist die Tabelle <code>news_sources</code> angelegt (schema.sql)?
        </div>
      )}

      {/* Hinzufügen */}
      <div className="card p-4">
        <p className="label-caps">Quelle hinzufügen</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="kicker.de"
            className="min-w-48 flex-1 rounded-md border border-ink-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Notiz (optional) — warum diese Quelle?"
            className="min-w-48 flex-[2] rounded-md border border-ink-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
          <button onClick={add} disabled={busy || !supabaseEnabled} className="btn-signal disabled:opacity-50">
            Hinzufügen
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Nur die Domain, ohne https:// und ohne Pfad. Sinnvoll sind deutsche
          Quellen zur 1. Bundesliga. Paywall-Seiten bringen nichts — die
          Suche kommt an die Inhalte nicht heran.
        </p>
      </div>

      {/* Liste */}
      {usingDefaults ? (
        <div className="card p-4">
          <p className="text-sm">
            Aktuell gilt die <strong>Standardliste</strong> mit{" "}
            {DEFAULT_SOURCES.length} Quellen:
          </p>
          <p className="mt-2 font-mono text-xs text-ink-muted">
            {DEFAULT_SOURCES.join(" · ")}
          </p>
          <button
            onClick={seedDefaults}
            disabled={busy || !supabaseEnabled}
            className="btn-ghost mt-3 text-sm disabled:opacity-50"
          >
            Standardliste übernehmen und bearbeitbar machen
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-ink-line">
          {rows!.map((r) => (
            <div key={r.domain} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className={`font-mono text-sm ${r.active ? "" : "text-ink-muted line-through"}`}>
                  {r.domain}
                </p>
                {r.note && <p className="text-xs text-ink-muted">{r.note}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  onClick={() => toggle(r)}
                  disabled={busy}
                  className="text-sm text-signal hover:underline disabled:opacity-50"
                >
                  {r.active ? "pausieren" : "aktivieren"}
                </button>
                <button
                  onClick={() => remove(r)}
                  disabled={busy}
                  className="text-ink-muted hover:text-signal disabled:opacity-50"
                  title="Entfernen"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!usingDefaults && (
        <p className="text-sm text-ink-muted">
          {active.length} aktive {active.length === 1 ? "Quelle" : "Quellen"}. Die
          Änderung greift ab dem nächsten Recherche-Lauf — der News-Sammler läuft
          zweimal täglich, Scout und Tier-Analyse auf Knopfdruck.
        </p>
      )}
    </div>
  );
}
