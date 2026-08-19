// KI-Statusvorschlag mit eigener News-Recherche: Claude durchsucht per
// Web-Search-Tool die aktuellen voraussichtlichen Aufstellungen / Verletzungsnews
// zu den Vereinen des Kaders und leitet pro Spieler start/doubt/bench/out ab.
// Server-seitig (API-Key geheim). Nur Vorschlag — Kai bestätigt.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Status } from "@/lib/engine/types";
import { pruneBlockedDomains } from "@/lib/webSearch";
import { loadAllowedDomains } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 120; // Web-Recherche kann mehrere Sekunden dauern

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

// Harte Quellen-Whitelist: die Suche durchsucht NUR diese Domains. Per Env
// NEWS_ALLOWED_DOMAINS (kommagetrennt) überschreibbar; sonst diese Standardliste
// spezialisierter deutscher Aufstellungs-/Verletzungsquellen.
const DEFAULT_DOMAINS = [
  "kicker.de",
  "ligainsider.de",
  "sport1.de",
  "bundesliga.com",
  "fussballdaten.de",
  "spox.com",
  "ran.de",
  "sport.de",
  "comunio.de", // deutsche Fantasy-Community, Aufstellungstipps wie ligainsider
];
const ALLOWED_DOMAINS = (process.env.NEWS_ALLOWED_DOMAINS || "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);
const FALLBACK_DOMAINS = ALLOWED_DOMAINS.length ? ALLOWED_DOMAINS : DEFAULT_DOMAINS;

// Web-Search-Tool-Version passend zum Modell (Dynamic Filtering auf Opus 4.x /
// Sonnet 4.6, sonst die Basis-Variante). allowed_domains beschränkt hart.
function webSearchTool(maxUses: number, domains: string[]) {
  const modern = /^claude-(opus-4|sonnet-4-6)/.test(MODEL);
  return {
    type: modern ? "web_search_20260209" : "web_search_20250305",
    name: "web_search",
    max_uses: maxUses,
    allowed_domains: domains,
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

const SYSTEM = (DOMAINS: string[]) => `Du bist Recherche-Assistent für das kicker-Managerspiel zur
1. Bundesliga (Deutschland). NUR 1. Bundesliga — keine 2. Liga, keine anderen
Ligen. Der Kader steht fest. Recherchiere AUSSCHLIESSLICH zu den unten genannten
Vereinen und den dort aufgelisteten Kaderspielern — keine anderen Vereine, keine
anderen Spieler.

Vorgehen:
1. Gehe die Vereine der Reihe nach durch. Mache PRO VEREIN GENAU EINE gezielte Suche
   nach der aktuellen voraussichtlichen Aufstellung / Verletzungs- und Sperren-News
   zum genannten Spiel (Gegner + Datum), z.B. "voraussichtliche Aufstellung
   <Verein> <Gegner>". Nutze das web_search-Tool. Die Suche ist technisch auf diese
   Quellen beschränkt: ${DOMAINS.join(", ")}.
2. Prüfe im Suchergebnis NUR die für diesen Verein aufgelisteten Kaderspieler und
   leite je Spieler den Status ab:
   - "start": klar gesetzt / Stammelf
   - "doubt": fraglich, Rotationskandidat, angeschlagen
   - "bench": wahrscheinlich Bank
   - "out": verletzt, gesperrt, nicht im Kader
3. Rufe am Ende report_status auf.

Regeln:
- Recherchiere nicht breiter als nötig: die Kaderspieler sind die einzige Zielmenge.
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

  // Nach Verein gruppieren → eine Suche pro Verein, nur die Kaderspieler zählen.
  const byClub = new Map<string, { opponent?: string; kickoff?: string | null; names: string[] }>();
  for (const p of players) {
    const club = p.club ?? "?";
    const g = byClub.get(club) ?? { opponent: p.opponent, kickoff: p.kickoff, names: [] };
    g.names.push(`${p.name} (${p.position ?? "?"})`);
    byClub.set(club, g);
  }
  const roster = [...byClub.entries()]
    .map(([club, g]) => {
      const game = g.opponent
        ? ` — Spiel: ${g.opponent}${g.kickoff ? ` am ${g.kickoff.slice(0, 10)}` : ""}`
        : "";
      return `${club}${game}\n  Kaderspieler: ${g.names.join(", ")}`;
    })
    .join("\n");
  const clubCount = byClub.size;
  const extra = newsText?.trim()
    ? `\n\nZUSÄTZLICHER KONTEXT (vom Nutzer eingefügt):\n${newsText.trim()}`
    : "";
  const userText = `KADER NACH VEREIN (fest — nur diese Vereine/Spieler recherchieren):\n${roster}${extra}\n\nEine Suche pro Verein. Danach report_status aufrufen.`;

  const client = new Anthropic({ apiKey, timeout: 110_000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DOMAINS = await loadAllowedDomains(FALLBACK_DOMAINS);
  const tools: any[] = [webSearchTool(Math.min(clubCount * 2, 16), DOMAINS), REPORT_TOOL];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userText }];

  try {
    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM(DOMAINS),
        tools,
        messages,
      });
    } catch (e) {
      if (!pruneBlockedDomains(tools, e)) throw e;
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM(DOMAINS),
        tools,
        messages,
      });
    }
    // Server-Tool-Schleife (web_search) kann pausieren → fortsetzen.
    let guard = 0;
    while (response.stop_reason === "pause_turn" && guard++ < 6) {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM(DOMAINS),
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
