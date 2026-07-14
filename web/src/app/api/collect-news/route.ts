// Täglicher News-Sammler (Vercel-Cron). Claude durchsucht die letzten ~24-48h
// nach den wichtigsten Bundesliga-News (Transfers, Trainer, Rückkehrer,
// Verletzungen/Sperren, Vorbereitung) und schreibt strukturierte Einträge in die
// Supabase-Memory `news_log`. Geschützt per CRON_SECRET (Vercel setzt den Header).
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import { canon } from "@/lib/engine/clubs";
import { DURABLE_TYPES, type NewsType } from "@/lib/news";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const DEFAULT_DOMAINS = [
  "kicker.de",
  "ligainsider.de",
  "sport1.de",
  "bundesliga.com",
];
const ENV_DOMAINS = (process.env.NEWS_COLLECT_ALLOWED_DOMAINS || "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);
const DOMAINS = ENV_DOMAINS.length ? ENV_DOMAINS : DEFAULT_DOMAINS;

function webSearchTool() {
  const modern = /^claude-(opus-4|sonnet-4-6)/.test(MODEL);
  return {
    type: modern ? "web_search_20260209" : "web_search_20250305",
    name: "web_search",
    max_uses: 12,
    allowed_domains: DOMAINS,
  };
}

const TYPES: NewsType[] = [
  "transfer_in",
  "transfer_out",
  "coach",
  "injury",
  "suspension",
  "return",
  "preseason_form",
  "other",
];

const REPORT_TOOL = {
  name: "report_news",
  description: "Meldet die wichtigsten Bundesliga-News der letzten ~48h.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            club: { type: "string", description: "betroffener Verein (falls zuordenbar)" },
            player: { type: "string", description: "betroffener Spieler (falls zutreffend)" },
            type: { type: "string", enum: TYPES },
            durable: {
              type: "boolean",
              description: "true = dauerhafter Fakt (Transfer/Trainer/Sperre/Verletzung m. Dauer); false = flüchtiges Signal (Gerücht, Form)",
            },
            summary: { type: "string", description: "1 Satz, sachlich" },
            source: { type: "string", description: "Quelle (Domain oder URL)" },
          },
          required: ["type", "durable", "summary"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
};

const SYSTEM = `Du bist Nachrichten-Sammler für die Bundesliga-Kaderplanung. Suche die
WICHTIGSTEN News der letzten ~48 Stunden und melde sie strukturiert.

Kategorien (jetzt, WM-/Vorbereitungsphase, in dieser Priorität):
1. Transfers: bestätigte Zugänge/Abgänge (transfer_in/transfer_out).
2. Trainerwechsel (coach), Rückkehrer aus Leihe/Verletzung/WM (return).
3. Verletzungen & Sperren (injury/suspension) — mit Dauer, falls bekannt.
4. Vorbereitung (preseason_form): Testspiel-Auftritte, wer fällt auf — sobald verfügbar.

Regeln:
- Nur echte, belegte Meldungen. Erfinde nichts. Keine reinen Gerüchte ohne Substanz.
- "durable": Transfers, Trainerwechsel, Sperren, Verletzungen mit Dauer = true;
  Formkurve, Vorbereitungs-Eindruck, vage Meldungen = false.
- Pro Meldung EIN Eintrag, "summary" ein sachlicher Satz, "source" die Quelle.
- Quellen technisch beschränkt auf: ${DOMAINS.join(", ")}.
- Ziel: 8-20 relevante Einträge. Am Ende report_news aufrufen.`;

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET(req: NextRequest) {
  // Schutz: nur mit CRON_SECRET (Vercel-Cron sendet den Bearer automatisch).
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET nicht gesetzt." }, { status: 501 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt." }, { status: 501 });
  }
  if (!supabaseEnabled || !supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert." }, { status: 501 });
  }

  // Keepalive: DB VOR dem KI-Call berühren — so zählt jeder Cron-Lauf als
  // Supabase-Aktivität (Free-Tier pausiert nach 7 Tagen ohne Aktivität),
  // selbst wenn die Recherche danach fehlschlägt.
  await supabase.from("news_log").select("id", { head: true, count: "exact" });

  const today = new Date().toISOString().slice(0, 10);
  const client = new Anthropic({ apiKey, timeout: 110_000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [webSearchTool(), REPORT_TOOL];
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Sammle die wichtigsten Bundesliga-News (Stand ${today}) und rufe report_news auf.` },
  ];

  try {
    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      tools,
      messages,
    });
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
      (b) => b.type === "tool_use" && b.name === "report_news",
    );
    if (!block || block.type !== "tool_use") {
      return NextResponse.json({ inserted: 0, note: "keine Auswertung" });
    }
    const raw = (block.input as { items?: unknown }).items;
    const typeSet = new Set(TYPES);
    const rows = (Array.isArray(raw) ? raw : [])
      .map((s) => s as {
        club?: string;
        player?: string;
        type?: string;
        durable?: boolean;
        summary?: string;
        source?: string;
      })
      .filter((s) => s.summary && typeSet.has(s.type as NewsType))
      .map((s) => {
        const clubCode = s.club ? canon(s.club) : null;
        const type = s.type as NewsType;
        const durable = s.durable ?? DURABLE_TYPES.includes(type);
        // Gruppiert dieselbe Story über Tage (Typ + Verein + Spieler/Kern).
        const key = `${type}:${clubCode ?? "x"}:${slug(s.player || s.summary!)}`;
        return {
          news_date: today,
          club: clubCode,
          player: s.player ?? null,
          type,
          durable,
          summary: s.summary!,
          source: s.source ?? null,
          dedup_key: key,
        };
      });

    if (!rows.length) return NextResponse.json({ inserted: 0 });
    const { error, count } = await supabase
      .from("news_log")
      .upsert(rows, { onConflict: "dedup_key", count: "exact" });
    if (error) {
      return NextResponse.json({ error: `DB: ${error.message}` }, { status: 502 });
    }
    return NextResponse.json({ inserted: count ?? rows.length, model: MODEL });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json(
      { error: `Sammeln fehlgeschlagen: ${err.message ?? "unbekannt"}` },
      { status: err.status && err.status < 500 ? 400 : 502 },
    );
  }
}
