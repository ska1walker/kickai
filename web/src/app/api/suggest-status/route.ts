// KI-Statusvorschlag: liest den eingefügten News-Text und schlägt pro
// Kaderspieler start/doubt/bench/out vor. Läuft server-seitig (API-Key bleibt
// geheim). Nur Vorschlag — Kai bestätigt in der UI (Decision-Support, kein Bot).
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Status } from "@/lib/engine/types";

export const runtime = "nodejs";

// Default laut Anthropic-Guidance das fähigste Modell; per Env übersteuerbar
// (z.B. claude-haiku-4-5 oder claude-sonnet-4-6 für geringere Kosten).
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const SYSTEM = `Du bist Assistent für das kicker-Managerspiel. Aufgabe: aus einem
eingefügten deutschen Aufstellungs-/News-Text pro Kaderspieler den wahrscheinlichen
Einsatz-Status für den kommenden Spieltag ableiten.

Statuswerte:
- "start": spielt sehr wahrscheinlich von Beginn (Stammelf, klar gesetzt)
- "doubt": fraglich, Rotationskandidat, angeschlagen aber evtl. dabei
- "bench": sitzt wahrscheinlich zunächst auf der Bank
- "out": verletzt, gesperrt, nicht im Kader oder spielt sicher nicht

Regeln:
- Bewerte NUR anhand des Textes und der bekannten Fußball-Logik. Erfinde nichts.
- Nenne einen Spieler nur, wenn der Text ein belastbares Signal gibt. Ohne Signal
  weglassen (nicht raten).
- Nutze EXAKT die Namen aus der Kaderliste.
- "reason" kurz (max. ein Satz), auf Deutsch, mit Textbezug.`;

const TOOL = {
  name: "report_status",
  description: "Meldet die abgeleiteten Einsatz-Status der Kaderspieler.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Exakter Name aus der Kaderliste" },
            status: { type: "string", enum: ["start", "doubt", "bench", "out"] },
            reason: { type: "string", description: "Kurze Begründung mit Textbezug" },
          },
          required: ["name", "status", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["suggestions"],
    additionalProperties: false,
  },
};

interface PlayerIn {
  name: string;
  club?: string;
  position?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KI nicht konfiguriert: ANTHROPIC_API_KEY fehlt." },
      { status: 501 },
    );
  }

  const { newsText, players } = (await req.json().catch(() => ({}))) as {
    newsText?: string;
    players?: PlayerIn[];
  };
  if (!newsText?.trim() || !players?.length) {
    return NextResponse.json(
      { error: "newsText und players sind nötig." },
      { status: 400 },
    );
  }

  const roster = players
    .map((p) => `- ${p.name} (${p.position ?? "?"}, ${p.club ?? "?"})`)
    .join("\n");
  const userText = `KADER:\n${roster}\n\nNEWS-TEXT:\n${newsText.trim()}`;

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "report_status" },
      messages: [{ role: "user", content: userText }],
    });
    const block = msg.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return NextResponse.json({ error: "Keine Auswertung erhalten." }, { status: 502 });
    }
    const raw = (block.input as { suggestions?: unknown }).suggestions;
    const valid: Status[] = ["start", "doubt", "bench", "out"];
    const known = new Set(players.map((p) => p.name));
    const suggestions = (Array.isArray(raw) ? raw : [])
      .map((s) => s as { name?: string; status?: string; reason?: string })
      .filter((s) => s.name && known.has(s.name) && valid.includes(s.status as Status))
      .map((s) => ({ name: s.name!, status: s.status as Status, reason: s.reason ?? "" }));

    return NextResponse.json({ suggestions, model: MODEL });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json(
      { error: `KI-Abruf fehlgeschlagen: ${err.message ?? "unbekannt"}` },
      { status: err.status && err.status < 500 ? 400 : 502 },
    );
  }
}
