"use client";
import { useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import { CLUB_LABEL } from "@/lib/engine/clubs";
import { newsWeight, IMPACT_LABEL, TYPE_LABEL, type NewsItem } from "@/lib/news";

const IMPACT_CHIP: Record<number, string> = {
  4: "bg-signal text-white",
  3: "bg-signal-50 text-signal-700",
  2: "bg-white text-ink-muted border border-ink-line",
  1: "bg-white text-ink-muted border border-ink-line opacity-60",
};

const TYPE_STYLE: Record<string, string> = {
  transfer_in: "bg-signal text-white",
  transfer_out: "bg-ink-line text-ink",
  coach: "bg-amber-100 text-amber-900",
  injury: "bg-white text-ink-muted border border-ink-line",
  suspension: "bg-white text-ink-muted border border-ink-line",
  return: "bg-signal-50 text-signal-700",
  preseason_form: "bg-amber-100 text-amber-900",
  other: "bg-white text-ink-muted border border-ink-line",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled || !supabase) {
      setItems([]);
      return;
    }
    supabase
      .from("news_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(120)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setItems((data as NewsItem[]) ?? []);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">News-Memory</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Gesammelte Transfer- & Kader-News
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Zwei tägliche Läufe sammeln die wichtigsten Bundesliga-News (Transfers,
          Trainer, Rückkehrer, Verletzungen, Vorbereitung). Jede Meldung wird nach
          <strong className="text-ink"> Managerspiel-Relevanz</strong> bewertet
          (kritisch/hoch/mittel/gering: ändert sie, wer spielt?) und nach
          Aktualität abgewertet — der Balken zeigt das kombinierte Gewicht, mit dem
          die Meldung in Entscheidungen einfließt. Sortiert nach Gewicht.
        </p>
      </div>

      {!supabaseEnabled && (
        <div className="card p-4 text-sm text-ink-muted">
          Supabase ist nicht konfiguriert — ohne DB kann keine Memory gespeichert werden.
        </div>
      )}
      {error && (
        <div className="card border-signal p-3 text-sm text-signal-700">
          Fehler: {error}. Ist die Tabelle <code>news_log</code> angelegt (schema.sql)?
        </div>
      )}
      {items && items.length === 0 && supabaseEnabled && !error && (
        <div className="card p-4 text-sm text-ink-muted">
          Noch keine News gesammelt. Der Cron läuft täglich (06:00) — oder manuell
          per <code>GET /api/collect-news</code> mit dem CRON_SECRET anstoßen.
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card divide-y divide-ink-line">
          {[...items]
            .sort((a, b) => newsWeight(b) - newsWeight(a))
            .map((it) => {
            const w = newsWeight(it);
            return (
              <div key={it.id} className="flex items-start gap-3 px-4 py-3">
                <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-ink-muted">
                  {fmtDate(it.created_at)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`chip text-[10px] ${IMPACT_CHIP[it.impact ?? 2]}`}>
                      {IMPACT_LABEL[it.impact ?? 2]}
                    </span>
                    <span className={`chip text-[10px] ${TYPE_STYLE[it.type]}`}>
                      {TYPE_LABEL[it.type]}
                    </span>
                    {it.club && (
                      <span className="text-xs font-medium text-ink">
                        {CLUB_LABEL[it.club] ?? it.club}
                      </span>
                    )}
                    {it.player && <span className="text-xs text-ink-muted">{it.player}</span>}
                    {it.durable && (
                      <span className="text-[10px] text-ink-muted">· Fakt</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{it.summary}</p>
                  {it.source && (
                    <p className="mt-0.5 text-xs text-ink-muted">{it.source}</p>
                  )}
                </div>
                <div className="w-16 shrink-0 pt-1 text-right">
                  <div className="ml-auto h-1.5 w-14 overflow-hidden rounded-full bg-ink-line">
                    <div
                      className="h-full bg-signal"
                      style={{ width: `${Math.round(w * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-ink-muted">{Math.round(w * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
