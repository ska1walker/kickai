// Rechenweg eines Spielers: Basis → jeder Faktor mit seiner Punkte-Wirkung.
// Macht jede Empfehlung Schritt für Schritt nachprüfbar statt nur plausibel.
"use client";
import type { ScoreBreakdown } from "@/lib/engine/builder";

const fmtFactor = (f: number) => `×${f.toFixed(2)}`;
const fmtDelta = (d: number) => `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(0)}`;

export function ScoreTrace({ bd }: { bd: ScoreBreakdown }) {
  return (
    <div className="mt-2 rounded-md border border-ink-line bg-canvas/60 p-2.5">
      <p className="label-caps text-[10px]">Rechenweg</p>
      <table className="mt-1.5 w-full text-xs">
        <tbody>
          <tr>
            <td className="py-0.5 pr-2 font-mono text-ink-muted">Basis</td>
            <td className="py-0.5 pr-2 text-right font-mono">{bd.base.toFixed(0)}</td>
            <td className="py-0.5 pr-2 text-right font-mono text-ink-muted">—</td>
            <td className="py-0.5 text-ink-muted">{bd.baseLabel}</td>
          </tr>
          {bd.steps.map((s, i) => (
            <tr key={i}>
              <td className="py-0.5 pr-2 font-mono text-ink-muted">{fmtFactor(s.factor)}</td>
              <td
                className={`py-0.5 pr-2 text-right font-mono ${
                  s.delta >= 0 ? "text-signal" : "text-ink-muted"
                }`}
              >
                {fmtDelta(s.delta)}
              </td>
              <td className="py-0.5 pr-2 whitespace-nowrap font-medium">{s.label}</td>
              <td className="py-0.5 text-ink-muted">{s.why}</td>
            </tr>
          ))}
          <tr className="border-t border-ink-line">
            <td className="pt-1 pr-2 font-mono font-semibold">Score</td>
            <td className="pt-1 pr-2 text-right font-mono font-semibold">
              {bd.score.toFixed(0)}
            </td>
            <td className="pt-1 pr-2" />
            <td className="pt-1 text-ink-muted">
              Rangwert für den Vergleich innerhalb der Position — nicht die
              erwarteten Spieltagspunkte.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
