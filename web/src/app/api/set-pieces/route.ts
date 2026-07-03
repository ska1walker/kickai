// #5 Standard-/Elfmeterschützen-Recherche für die Kaderplanung. Claude sucht je
// Verein den Elfmeter- und Hauptstandardschützen. Diese Spieler haben einen
// unterbepreisten Punkte-Boden (ABW-Tor = +5). Server-seitig, web_search.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const DEFAULT_DOMAINS = ["kicker.de", "ligainsider.de", "fussballdaten.de", "bundesliga.com"];
const ENV_DOMAINS = (process.env.SETPIECE_ALLOWED_DOMAINS || "").split(",").map((d) => d.trim()).filter(Boolean);
const DOMAINS = ENV_DOMAINS.length ? ENV_DOMAINS : DEFAULT_DOMAINS;

function webSearchTool() {
  const modern = /^claude-(opus-4|sonnet-4-6)/.test(MODEL);
  return { type: modern ? "web_search_20260209" : "web_search_20250305", name: "web_search", max_uses: 12, allowed_domains: DOMAINS };
}

const REPORT_TOOL = {
  name: "report_takers",
  description: "Meldet Standard-/Elfmeterschützen je Verein.",
  input_schema: {
    type: "object" as const,
    properties: {
      takers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            player: { type: "string", description: "Spielername" },
            club: { type: "string" },
            role: { type: "string", enum: ["penalty", "freekick", "corner"] },
          },
          required: ["player", "role"],
          additionalProperties: false,
        },
      },
    },
    required: ["takers"],
    additionalProperties: false,
  },
};

const SYSTEM = `Du recherchierst für die Bundesliga-Kaderplanung die Standard- und
Elfmeterschützen. Ziel: Spieler mit unterbepreistem Punkte-Boden (ein Abwehr-Tor
gibt +5). Finde je Verein:
- den designierten ELFMETERSCHÜTZEN ("penalty"),
- den/die Hauptschützen für Freistöße ("freekick") und Ecken ("corner"), sofern klar.

Regeln:
- Nur belegte, aktuelle Schützen. Ohne klaren Beleg weglassen.
- Ein Eintrag pro Spieler+Rolle. Quellen technisch beschränkt auf: ${DOMAINS.join(", ")}.
- Am Ende report_takers aufrufen.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt." }, { status: 501 });

  const { clubs } = (await req.json().catch(() => ({}))) as { clubs?: string[] };
  if (!clubs?.length) return NextResponse.json({ error: "clubs sind nötig." }, { status: 400 });

  const userText = `VEREINE (nur diese):\n${clubs.map((c) => `- ${c}`).join("\n")}\n\nRecherchiere und rufe dann report_takers auf.`;
  const client = new Anthropic({ apiKey, timeout: 110_000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [webSearchTool(), REPORT_TOOL];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userText }];

  try {
    let response = await client.messages.create({ model: MODEL, max_tokens: 6000, system: SYSTEM, tools, messages });
    let guard = 0;
    while (response.stop_reason === "pause_turn" && guard++ < 6) {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create({ model: MODEL, max_tokens: 6000, system: SYSTEM, tools, messages });
    }
    const block = response.content.find((b) => b.type === "tool_use" && b.name === "report_takers");
    if (!block || block.type !== "tool_use") return NextResponse.json({ takers: [], model: MODEL });
    const raw = (block.input as { takers?: unknown }).takers;
    const roles = new Set(["penalty", "freekick", "corner"]);
    const takers = (Array.isArray(raw) ? raw : [])
      .map((s) => s as { player?: string; club?: string; role?: string })
      .filter((s) => s.player && roles.has(s.role ?? ""))
      .map((s) => ({ player: s.player!, club: s.club ?? "", role: s.role as string }));
    return NextResponse.json({ takers, model: MODEL });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: `Recherche fehlgeschlagen: ${err.message ?? "unbekannt"}` }, { status: err.status && err.status < 500 ? 400 : 502 });
  }
}
