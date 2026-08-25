// Manuelle News-Eingabe: Kai fügt eine Meldung ein (oder einen ganzen
// Artikel-Absatz), Claude zerlegt sie in strukturierte Einträge für die
// News-Memory. Der Grund für diese Route: Die automatische Recherche findet
// Transfers und Verletzungen zuverlässig, aber die entscheidende Information
// ("dieser 0,5-Mio-Spieler ist jetzt gesetzt") steht oft in redaktionellen
// Managerspiel-Tipps, die kein Crawler sinnvoll einsammelt.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import { canon } from "@/lib/engine/clubs";
import { DURABLE_TYPES, type NewsType } from "@/lib/news";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const TYPES: NewsType[] = [
  "transfer_in",
  "transfer_out",
  "coach",
  "injury",
  "suspension",
  "return",
  "preseason_form",
  "starter",
  "other",
];

const REPORT_TOOL = {
  name: "report_news",
  description: "Zerlegt einen manuell eingefügten Text in News-Einträge.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            club: { type: "string", description: "Verein, falls genannt" },
            player: { type: "string", description: "Spielername, falls genannt" },
            type: { type: "string", enum: TYPES },
            durable: { type: "boolean" },
            impact: { type: "integer", enum: [1, 2, 3, 4] },
            summary: { type: "string", description: "1 sachlicher Satz" },
          },
          required: ["type", "durable", "impact", "summary"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
};

const SYSTEM = `Du strukturierst Meldungen zur 1. Bundesliga für ein
kicker-Managerspiel-System. Der Nutzer fügt Text ein (eine Meldung oder einen
ganzen Artikel). Zerlege ihn in einzelne Einträge — einen je Spieler und Sachverhalt.

Typ "starter" ist der wichtigste: Nutze ihn, wenn der Text belegt, dass ein
Spieler in der neuen Saison SPIELEN wird — Stammplatz, Startelf, "gesetzt",
"unangefochten", konkrete Einsatzzahlen, "vertritt den Verletzten", "Pflichtkauf
wegen mehr Einsätzen". Das ist die Information, die das System sonst nicht hat.

"impact" bemisst, wie stark der Beleg für Einsatzzeit ist:
  4 = unangefochtener Stammspieler, konkrete hohe Einsatzzahl ("34 Spiele", "Säule")
  3 = steht in der Startelf, überzeugt in der Vorbereitung, vertritt einen Verletzten
  2 = aussichtsreich, Einsatzzeit aber ausdrücklich offen ("ob er viel spielt, ist unklar")
  1 = reines Potenzial ohne Einsatz-Bezug

Weitere Regeln:
- "durable": Transfers, Trainerwechsel, Sperren und Verletzungen mit Dauer = true;
  Form- und Vorbereitungseindrücke = false.
- Nur 1. Bundesliga (Aufsteiger zählen dazu). Keine 2. Liga.
- Gib den Spielernamen so an, wie er im Text steht. Erfinde nichts dazu.
- Preise, Stellenanzeigen, Werbeblöcke und Fließtext ohne Spielerbezug überspringen.
- Am Ende report_news aufrufen.`;

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt." }, { status: 501 });
  if (!supabaseEnabled || !supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert." }, { status: 501 });
  }
  const { text, source } = (await req.json().catch(() => ({}))) as {
    text?: string;
    source?: string;
  };
  if (!text?.trim()) return NextResponse.json({ error: "Kein Text übergeben." }, { status: 400 });

  const client = new Anthropic({ apiKey, timeout: 55_000 });
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [REPORT_TOOL],
      tool_choice: { type: "tool", name: "report_news" },
      messages: [{ role: "user", content: text.slice(0, 30_000) }],
    });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json({ error: `KI-Aufruf fehlgeschlagen: ${err.message}` }, { status: 502 });
  }

  const block = response.content.find((b) => b.type === "tool_use" && b.name === "report_news");
  if (!block || block.type !== "tool_use") {
    return NextResponse.json({ inserted: 0, note: "keine verwertbare Meldung erkannt" });
  }
  const raw = (block.input as { items?: unknown }).items;
  const typeSet = new Set(TYPES);
  const today = new Date().toISOString().slice(0, 10);
  const rows = (Array.isArray(raw) ? raw : [])
    .map(
      (s) =>
        s as {
          club?: string;
          player?: string;
          type?: string;
          durable?: boolean;
          impact?: number;
          summary?: string;
        },
    )
    .filter((s) => s.summary && typeSet.has(s.type as NewsType))
    .map((s) => {
      const type = s.type as NewsType;
      const player =
        s.player && s.player.replace(/[^\p{L}\p{N}]/gu, "").length >= 3 ? s.player.trim() : null;
      const club = s.club ? canon(s.club) : null;
      return {
        news_date: today,
        club,
        player,
        type,
        durable: s.durable ?? DURABLE_TYPES.includes(type),
        impact: Math.min(4, Math.max(1, Math.round(s.impact ?? 2))),
        summary: s.summary!.trim(),
        source: source?.trim() || "manuell eingefügt",
        dedup_key: `${type}:${club ?? "x"}:${slug(player || s.summary!)}`,
      };
    });

  if (!rows.length) return NextResponse.json({ inserted: 0 });
  const { error } = await supabase.from("news_log").upsert(rows, { onConflict: "dedup_key" });
  if (error) return NextResponse.json({ error: `DB: ${error.message}` }, { status: 502 });
  return NextResponse.json({ inserted: rows.length, items: rows });
}
