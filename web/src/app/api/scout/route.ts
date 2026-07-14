// Talent-Scout für die Kaderauswahl: Claude recherchiert pro Spieler Signale,
// die der Marktwert NICHT abbildet — Vorbereitungsform, U21-Nationalspieler,
// Fritz-Walter-Medaille, erwartete Rolle — und leitet ein Durchbruch-/Rollen-
// Signal ab. Ergänzt die Kaderauswahl, ersetzt sie nicht. Server-seitig.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { pruneBlockedDomains } from "@/lib/webSearch";

export const runtime = "nodejs";
export const maxDuration = 300; // Recherche über mehrere Spieler dauert länger

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

// Quellen für Talent-/Nachwuchs-Recherche: DFB (U21, Fritz-Walter),
// kicker/ligainsider (Vorbereitung), fussballdaten. (transfermarkt.de blockiert
// Anthropics Such-Crawler → bewusst nicht in der Whitelist.)
const DEFAULT_SCOUT_DOMAINS = [
  "dfb.de",
  "kicker.de",
  "ligainsider.de",
  "fussballdaten.de",
  "fupa.net", // Jugend-/Testspiel-Berichte — stark für Vorbereitung
  "sport.de",
  "spox.com",
];
const ENV_DOMAINS = (process.env.SCOUT_ALLOWED_DOMAINS || "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);
const DOMAINS = ENV_DOMAINS.length ? ENV_DOMAINS : DEFAULT_SCOUT_DOMAINS;

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
  name: "report_scout",
  description: "Meldet die Talent-/Rollen-Signale je Spieler.",
  input_schema: {
    type: "object" as const,
    properties: {
      players: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Exakter Name aus der Liste" },
            signal: {
              type: "string",
              enum: ["hoch", "mittel", "niedrig", "unklar"],
              description: "Einschätzung der Stammplatz-/Durchbruch-Chance",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Kurz-Marker, z.B. 'U21-Nationalspieler', 'Fritz-Walter-Gold 2024', 'Vorbereitung stark'",
            },
            note: { type: "string", description: "1-2 Sätze Begründung mit Quelle" },
          },
          required: ["name", "signal", "tags", "note"],
          additionalProperties: false,
        },
      },
    },
    required: ["players"],
    additionalProperties: false,
  },
};

const SYSTEM = `Du bist Talent-Scout für das kicker-Managerspiel. Für jeden Spieler
der Liste recherchiere Signale, die der Marktwert NICHT abbildet, und leite eine
Einschätzung der Stammplatz-/Durchbruch-Chance für die kommende Saison ab.

Zu jedem Spieler recherchiere (web_search):
1. VORBEREITUNG: Auftritte in Testspielen der aktuellen Sommer-Vorbereitung —
   Tore/Assists, positiv aufgefallen, viel/wenig Spielzeit?
2. U21-NATIONALSPIELER: aktuell für eine U21 (oder A-Nationalelf) nominiert/im Einsatz?
3. FRITZ-WALTER-MEDAILLE: Träger (Gold/Silber/Bronze) — falls ja, Jahr/Kategorie.
4. ROLLE: deutet alles auf Stammplatz, Rotation oder Reservistendasein hin
   (neuer Trainer, Konkurrenz, Leihe/Rückkehr)?

Leite daraus "signal" ab:
- "hoch": mehrere positive Signale, Stammplatz wahrscheinlich / im Aufwind
- "mittel": Signale gemischt oder Rotationsrolle
- "niedrig": wenig Anzeichen für viel Spielzeit
- "unklar": zu wenig belastbare Information gefunden

Regeln:
- Recherchiere NUR zu den gelisteten Spielern. Erfinde nichts; ohne Beleg "unklar".
- Nutze EXAKT die Namen aus der Liste.
- "tags": nur belegte Marker. "note": 1-2 knappe Sätze mit Quellenhinweis.
- Quellen technisch beschränkt auf: ${DOMAINS.join(", ")}.
- Am Ende report_scout aufrufen.`;

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

  const { players } = (await req.json().catch(() => ({}))) as { players?: PlayerIn[] };
  if (!players?.length) {
    return NextResponse.json({ error: "players sind nötig." }, { status: 400 });
  }
  if (players.length > 30) {
    return NextResponse.json(
      { error: "Bitte höchstens 30 Spieler auf einmal scouten." },
      { status: 400 },
    );
  }

  const list = players
    .map((p) => `- ${p.name} (${p.position ?? "?"}, ${p.club ?? "?"})`)
    .join("\n");
  const userText = `SPIELER (nur diese scouten):\n${list}\n\nRecherchiere und rufe dann report_scout auf.`;

  const client = new Anthropic({ apiKey, timeout: 290_000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [webSearchTool(Math.min(players.length * 2, 30)), REPORT_TOOL];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userText }];

  try {
    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        tools,
        messages,
      });
    } catch (e) {
      if (!pruneBlockedDomains(tools, e)) throw e;
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        tools,
        messages,
      });
    }
    let guard = 0;
    while (response.stop_reason === "pause_turn" && guard++ < 8) {
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
      (b) => b.type === "tool_use" && b.name === "report_scout",
    );
    if (!block || block.type !== "tool_use") {
      return NextResponse.json({ players: [], model: MODEL });
    }
    const raw = (block.input as { players?: unknown }).players;
    const known = new Set(players.map((p) => p.name));
    const signals = new Set(["hoch", "mittel", "niedrig", "unklar"]);
    const results = (Array.isArray(raw) ? raw : [])
      .map((s) => s as { name?: string; signal?: string; tags?: unknown; note?: string })
      .filter((s) => s.name && known.has(s.name) && signals.has(s.signal ?? ""))
      .map((s) => ({
        name: s.name!,
        signal: s.signal as "hoch" | "mittel" | "niedrig" | "unklar",
        tags: Array.isArray(s.tags) ? (s.tags as unknown[]).map(String).slice(0, 5) : [],
        note: s.note ?? "",
      }));

    return NextResponse.json({ players: results, model: MODEL });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json(
      { error: `Scout-Recherche fehlgeschlagen: ${err.message ?? "unbekannt"}` },
      { status: err.status && err.status < 500 ? 400 : 502 },
    );
  }
}
