// Team-Tier-Analyse für die Kaderplanung: Claude recherchiert, welche
// Bundesliga-Teams die kommende Saison im oberen Drittel erwartet werden und
// welche Überraschungskandidaten (gute Transfers, Aufwind) gehandelt werden.
// Ziel: günstige Spieler unterschätzter, aber starker Teams identifizieren.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { canon } from "@/lib/engine/clubs";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const DEFAULT_DOMAINS = [
  "kicker.de",
  "transfermarkt.de",
  "ligainsider.de",
  "sport1.de",
  "bundesliga.com",
];
const ENV_DOMAINS = (process.env.TIERS_ALLOWED_DOMAINS || "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);
const DOMAINS = ENV_DOMAINS.length ? ENV_DOMAINS : DEFAULT_DOMAINS;

function webSearchTool(maxUses: number) {
  const modern = /^claude-(opus-4|sonnet-4-6)/.test(MODEL);
  return {
    type: modern ? "web_search_20260209" : "web_search_20250305",
    name: "web_search",
    max_uses: maxUses,
    allowed_domains: DOMAINS,
  };
}

const REPORT_TOOL = {
  name: "report_tiers",
  description: "Meldet die erwartete Tabellen-Region je Verein.",
  input_schema: {
    type: "object" as const,
    properties: {
      clubs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            club: { type: "string", description: "Vereinsname" },
            tier: {
              type: "string",
              enum: ["top", "surprise", "mid", "lower"],
              description:
                "top=erwartet oberes Drittel; surprise=Überraschungskandidat oberes Drittel (gute Transfers/Aufwind); mid=Mittelfeld; lower=unteres Drittel/Abstiegskampf",
            },
            reason: { type: "string", description: "Kurze Begründung mit Quelle" },
          },
          required: ["club", "tier", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["clubs"],
    additionalProperties: false,
  },
};

const SYSTEM = `Du bist Analyst für die Bundesliga-Saisonprognose. Recherchiere für
die kommende Saison die erwartete Tabellen-Region der Vereine (Prognosen, Transfer-
Bewertungen, Experten-Einschätzungen).

Ordne jeden genannten Verein einer Stufe zu:
- "top": klar im oberen Drittel erwartet (z.B. Bayern, Dortmund, Leverkusen)
- "surprise": Überraschungskandidat fürs obere Drittel — starke Transfers, Aufwind,
  guter Trainer, wird von vielen unterschätzt. DAS ist die wichtigste Kategorie:
  günstige Spieler solcher Teams punkten oft überdurchschnittlich.
- "mid": gesichertes Mittelfeld
- "lower": unteres Drittel / Abstiegskampf erwartet

Regeln:
- Nur die unten genannten Vereine bewerten.
- Belege die Einschätzung (Transfers, Prognosen). "reason": ein knapper Satz mit Quelle.
- Quellen technisch beschränkt auf: ${DOMAINS.join(", ")}.
- Am Ende report_tiers aufrufen.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KI nicht konfiguriert: ANTHROPIC_API_KEY fehlt." },
      { status: 501 },
    );
  }

  const { clubs } = (await req.json().catch(() => ({}))) as { clubs?: string[] };
  if (!clubs?.length) {
    return NextResponse.json({ error: "clubs sind nötig." }, { status: 400 });
  }

  const userText = `VEREINE (nur diese bewerten):\n${clubs.map((c) => `- ${c}`).join("\n")}\n\nRecherchiere und rufe dann report_tiers auf.`;

  const client = new Anthropic({ apiKey, timeout: 110_000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [webSearchTool(12), REPORT_TOOL];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userText }];

  try {
    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: SYSTEM,
      tools,
      messages,
    });
    let guard = 0;
    while (response.stop_reason === "pause_turn" && guard++ < 6) {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 6000,
        system: SYSTEM,
        tools,
        messages,
      });
    }

    const block = response.content.find(
      (b) => b.type === "tool_use" && b.name === "report_tiers",
    );
    if (!block || block.type !== "tool_use") {
      return NextResponse.json({ tiers: {}, model: MODEL });
    }
    const raw = (block.input as { clubs?: unknown }).clubs;
    const tierSet = new Set(["top", "surprise", "mid", "lower"]);
    const tiers: Record<string, { tier: string; reason: string }> = {};
    (Array.isArray(raw) ? raw : [])
      .map((s) => s as { club?: string; tier?: string; reason?: string })
      .filter((s) => s.club && tierSet.has(s.tier ?? ""))
      .forEach((s) => {
        const code = canon(s.club!);
        if (code) tiers[code] = { tier: s.tier!, reason: s.reason ?? "" };
      });

    return NextResponse.json({ tiers, model: MODEL });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json(
      { error: `Tier-Analyse fehlgeschlagen: ${err.message ?? "unbekannt"}` },
      { status: err.status && err.status < 500 ? 400 : 502 },
    );
  }
}
