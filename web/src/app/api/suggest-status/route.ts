// KI-Statusvorschlag mit eigener News-Recherche: Claude durchsucht per
// Web-Search-Tool die aktuellen voraussichtlichen Aufstellungen / Verletzungsnews
// zu den Vereinen des Kaders und leitet pro Spieler start/doubt/bench/out ab.
// Server-seitig (API-Key geheim). Nur Vorschlag — Kai bestätigt.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Status } from "@/lib/engine/types";

export const runtime = "nodejs";
export const maxDuration = 120; // Web-Recherche kann mehrere Sekunden dauern

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

// Web-Search-Tool-Version passend zum Modell (Dynamic Filtering auf Opus 4.x /
// Sonnet 4.6, sonst die Basis-Variante).
function webSearchTool() {
  const modern = /^claude-(opus-4|sonnet-4-6)/.test(MODEL);
  return {
    type: modern ? "web_search_20260209" : "web_search_20250305",
    name: "web_search",
    max_uses: 12,
  };
}

const REPORT_TOOL = {
  name: "report_status",
  description: "Meldet die recherchierten Einsatz-Status der Kaderspieler.",
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
            reason: { type: "string", description: "Kurze Begründung inkl. Quelle" },
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

const SYSTEM = `Du bist Recherche-Assistent für das kicker-Managerspiel. Ziel: für
jeden Kaderspieler den wahrscheinlichen Einsatz-Status im kommenden Spieltag
bestimmen — auf Basis EIGENER Web-Recherche.

Vorgehen:
1. Recherchiere je Verein die aktuelle voraussichtliche Aufstellung und
   Verletzungs-/Sperren-News zum genannten Spiel (Gegner + Datum). Nutze das
   web_search-Tool. Bevorzugte Quellen: kicker.de, ligainsider.de, transfermarkt.de,
   offizielle Vereinskanäle. Suche gezielt, z.B. "voraussichtliche Aufstellung
   <Verein> <Gegner>".
2. Leite pro Spieler den Status ab:
   - "start": klar gesetzt / Stammelf
   - "doubt": fraglich, Rotationskandidat, angeschlagen
   - "bench": wahrscheinlich Bank
   - "out": verletzt, gesperrt, nicht im Kader
3. Rufe am Ende report_status auf.

Regeln:
- Nur belegte Signale. Findest du zu einem Spieler nichts Belastbares, lasse ihn weg.
- Nutze EXAKT die Namen aus der Kaderliste.
- "reason": ein kurzer Satz auf Deutsch, mit Quellenhinweis (z.B. "laut kicker").`;

interface PlayerIn {
  name: string;
  club?: string;
  position?: string;
  opponent?: string;
  kickoff?: string | null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KI nicht konfiguriert: ANTHROPIC_API_KEY fehlt." },
      { status: 501 },
    );
  }

  const { players, newsText } = (await req.json().catch(() => ({}))) as {
    players?: PlayerIn[];
    newsText?: string;
  };
  if (!players?.length) {
    return NextResponse.json({ error: "players sind nötig." }, { status: 400 });
  }

  const roster = players
    .map((p) => {
      const game = p.opponent
        ? ` — Spiel: ${p.opponent}${p.kickoff ? ` am ${p.kickoff.slice(0, 10)}` : ""}`
        : "";
      return `- ${p.name} (${p.position ?? "?"}, ${p.club ?? "?"})${game}`;
    })
    .join("\n");
  const extra = newsText?.trim()
    ? `\n\nZUSÄTZLICHER KONTEXT (vom Nutzer eingefügt):\n${newsText.trim()}`
    : "";
  const userText = `KADER (mit jeweiligem Spiel):\n${roster}${extra}\n\nRecherchiere und rufe dann report_status auf.`;

  const client = new Anthropic({ apiKey, timeout: 110_000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [webSearchTool(), REPORT_TOOL];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userText }];

  try {
    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      tools,
      messages,
    });
    // Server-Tool-Schleife (web_search) kann pausieren → fortsetzen.
    let guard = 0;
    while (response.stop_reason === "pause_turn" && guard++ < 6) {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        tools,
        messages,
      });
    }

    const block = response.content.find(
      (b) => b.type === "tool_use" && b.name === "report_status",
    );
    if (!block || block.type !== "tool_use") {
      return NextResponse.json({ suggestions: [], model: MODEL });
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
      { error: `KI-Recherche fehlgeschlagen: ${err.message ?? "unbekannt"}` },
      { status: err.status && err.status < 500 ? 400 : 502 },
    );
  }
}
