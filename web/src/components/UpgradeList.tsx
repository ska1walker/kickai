// Verbesserungsvorschläge für den bestehenden Kader: was raus, was rein,
// was es bringt — inklusive Rechenweg des Zugangs.
"use client";
import { useState } from "react";
import type { Upgrade } from "@/lib/engine/upgrade";
import type { ScoreBreakdown } from "@/lib/engine/builder";
import { ScoreTrace } from "@/components/ScoreTrace";
import { CLUB_LABEL } from "@/lib/engine/clubs";
import { effectivePoints, type PoolPlayer } from "@/lib/data/pool";

const line = (p: PoolPlayer) =>
  `${p.mv.toFixed(1)}M · ${effectivePoints(p)} Pkt · ${CLUB_LABEL[p.club] ?? p.club}`;

export function UpgradeList({
  upgrades,
  onApply,
  trace,
  busy,
}: {
  upgrades: Upgrade[];
  onApply: (u: Upgrade) => void;
  trace: (p: PoolPlayer) => ScoreBreakdown;
  busy: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);

  if (!upgrades.length) {
    return (
      <div className="card p-4 text-sm text-ink-muted">
        Kein Tausch gefunden, der die beste Elf spürbar verbessert — dein Kader
        ist für die aktuelle Datenlage austherapiert. Sobald neue
        Vorbereitungs-News eintreffen, lohnt ein erneuter Blick.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {upgrades.map((u, i) => (
        <div key={i} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">
                {u.headline}
                {u.financed && (
                  <span className="chip ml-2 bg-amber-100 text-[10px] text-amber-900">
                    gegenfinanziert
                  </span>
                )}
              </p>
              <div className="mt-1.5 space-y-0.5 text-xs">
                {u.out.map((p) => (
                  <p key={p.id} className="text-ink-muted">
                    <span className="font-mono">raus</span>{" "}
                    <span className="font-medium text-ink">{p.name}</span> — {line(p)}
                  </p>
                ))}
                {u.in.map((p) => (
                  <p key={p.id} className="text-ink-muted">
                    <span className="font-mono text-signal">rein</span>{" "}
                    <span className="font-medium text-ink">{p.name}</span> — {line(p)}
                  </p>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-lg font-semibold text-signal">
                +{u.gain.toFixed(1)}
              </p>
              <p className="text-[10px] text-ink-muted">Pkt/Spieltag</p>
              <p className="mt-1 font-mono text-[10px] text-ink-muted">
                {u.mvAfter.toFixed(1)} / 42.5 Mio
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onApply(u)}
              disabled={busy}
              className="btn-signal text-sm disabled:opacity-50"
            >
              In den Kader übernehmen
            </button>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="text-sm text-signal hover:underline"
            >
              {open === i ? "Rechenweg ausblenden" : "Warum? Rechenweg zeigen"}
            </button>
          </div>

          {open === i && (
            <div className="mt-1">
              {u.in.map((p) => (
                <div key={p.id} className="mt-2">
                  <p className="label-caps text-[10px]">{p.name}</p>
                  <ScoreTrace bd={trace(p)} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
