// Täglicher News-Sammler (Vercel-Cron). Claude durchsucht die letzten ~24-48h
// nach den wichtigsten Bundesliga-News (Transfers, Trainer, Rückkehrer,
// Verletzungen/Sperren, Vorbereitung) und schreibt strukturierte Einträge in die
// Supabase-Memory `news_log`. Geschützt per CRON_SECRET (Vercel setzt den Header).
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import { canon } from "@/lib/engine/clubs";
import { DURABLE_TYPES, type NewsType } from "@/lib/news";
import { pruneBlockedDomains } from "@/lib/webSearch";
import { loadAllowedDomains } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 120;

// Haiku 5.5 statt Sonnet 5 (Okt 2026): 0,10$/0,50$ je MTok statt 2$/10$ —
// ein Zwanzigstel. Die Aufgabe ist "finde und strukturiere Meldungen", kein
// schwieriges Schlussfolgern, und der Lauf fragt jedes Mal neu, ob ein
// Ergebnis taugt (Rueckgabe "inserted", Issue bei Fehlschlag). Eigene
// Variable statt ANTHROPIC_MODEL: die teilen sich alle anderen KI-Routen
// (Statusvorschlag, Scout …), die sollen nicht mit heruntergestuft werden.
const MODEL = process.env.NEWS_COLLECT_MODEL || "claude-haiku-5-5";

// Preise je MTok (Input, Output) fuer die Kostenmeldung. Cache-Write 1,25x,
// Cache-Read 0,1x vom Input. Unbekanntes Modell → Sonnet-Preis (konservativ).
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};
const [PRICE_IN, PRICE_OUT] = PRICES[MODEL] ?? [2, 10];

// Breite Quellenliste — robots.txt-geprobt (Juli 2026). Sollte die Such-API eine
// Domain doch ablehnen, entfernt das Self-Healing (pruneBlockedDomains) sie
// automatisch und wiederholt den Aufruf.
const DEFAULT_DOMAINS = [
  "kicker.de",
  "ligainsider.de",
  "sport1.de",
  "bundesliga.com",
  "spox.com",
  "ran.de",
  "sport.de",
  "fupa.net",
  "reviersport.de",
  "90min.de",
  "fussballtransfers.com",
  "bulinews.com",
];
const ENV_DOMAINS = (process.env.NEWS_COLLECT_ALLOWED_DOMAINS || "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);
const FALLBACK_DOMAINS = ENV_DOMAINS.length ? ENV_DOMAINS : DEFAULT_DOMAINS;

function webSearchTool(domains: string[]) {
  // Die neue Websuche (dynamische Filterung) koennen Opus 4.6+, Sonnet 4.6
  // und Sonnet 5. ACHTUNG: "sonnet-5" muss hier stehen, sonst faellt der
  // Modellwechsel still auf die alte Tool-Version zurueck.
  const modern = /^claude-(opus-[45]|sonnet-5|sonnet-4-6|fable-)/.test(MODEL);
  return {
    type: modern ? "web_search_20260209" : "web_search_20250305",
    name: "web_search",
    max_uses: 16,
    allowed_domains: [...domains],
  };
}

// Rotierender Tages-Schwerpunkt: über die Woche werden alle Bereiche
// tiefergehend abgedeckt, statt jeden Tag nur die Schlagzeilen zu streifen.
const FOCUS: Record<number, string> = {
  0: "Vorbereitung & Testspiele: Ergebnisse, auffällige Spieler, Einsatzzeiten",
  1: "Transfers: bestätigte Wechsel und konkrete, substanzielle Gerüchte",
  2: "Verletzungen & Rückkehrer: Ausfalldauern, Aufbautraining, Comebacks",
  3: "Trainer & Taktik: Systeme, Hierarchien, wer ist gesetzt",
  4: "Vorbereitung & Testspiele: Ergebnisse, auffällige Spieler, Einsatzzeiten",
  5: "Transfers: bestätigte Wechsel und konkrete, substanzielle Gerüchte",
  6: "Aufsteiger & Überraschungsteams: Kaderqualität, Transferbilanz",
};

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
            impact: {
              type: "integer",
              enum: [1, 2, 3, 4],
              description:
                "Managerspiel-Relevanz: 4=kritisch (Stammspieler fällt lange aus / Star-Transfer), 3=hoch (ändert wahrscheinlich, wer spielt), 2=mittel (könnte Aufstellungen beeinflussen), 1=gering (Verein/Organisation/Termine ohne Aufstellungsbezug)",
            },
            summary: { type: "string", description: "1 Satz, sachlich" },
            source: { type: "string", description: "Quelle (Domain oder URL)" },
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

const SYSTEM = (DOMAINS: string[]) => `Du bist Nachrichten-Sammler für die Kaderplanung in der
1. Bundesliga (Deutschland). NUR 1. Bundesliga — keine 2. Liga, keine anderen
Ligen (Aufsteiger IN die 1. Bundesliga zählen dazu). Suche die WICHTIGSTEN News
der letzten ~48 Stunden und melde sie strukturiert.

Kategorien (jetzt, WM-/Vorbereitungsphase, in dieser Priorität):
1. Transfers: bestätigte Zugänge/Abgänge (transfer_in/transfer_out).
2. Trainerwechsel (coach), Rückkehrer aus Leihe/Verletzung/WM (return).
3. Verletzungen & Sperren (injury/suspension) — mit Dauer, falls bekannt.
4. Vorbereitung (preseason_form): Testspiel-Auftritte, wer fällt auf — sobald verfügbar.
5. STAMMPLATZ (starter): Meldungen, die belegen, dass ein Spieler SPIELEN wird —
   "gesetzt", "unangefochten", konkrete Einsatzzahlen, "vertritt den Verletzten".
   Dieser Typ ist besonders wertvoll: Einsatzzeit ist die eigentliche Punktequelle,
   und bei billigen Spielern ist sie aus Marktwert und Vorsaison nicht ableitbar.

Regeln:
- Nur echte, belegte Meldungen. Erfinde nichts. Keine reinen Gerüchte ohne Substanz.
- "durable": Transfers, Trainerwechsel, Sperren, Verletzungen mit Dauer = true;
  Formkurve, Vorbereitungs-Eindruck, vage Meldungen = false.
- "impact" = Managerspiel-Relevanz. Die einzige Frage: Ändert diese Meldung,
  WER SPIELT oder wie viele Punkte ein Spieler holt?
  4 = kritisch: Stammspieler fällt lange aus, Star-Transfer, Torwartwechsel
  3 = hoch: verändert wahrscheinlich Aufstellungen (Neuzugang auf besetzte
      Position, Trainerwechsel, Rückkehr eines Stammspielers)
  2 = mittel: könnte relevant werden (Testspiel-Auffälligkeit, Rotations-Indiz)
  1 = gering: KEIN Aufstellungsbezug (Vorstand, Sponsoren, Tickets, Termine,
      Stadion, Jubiläen) — solche Meldungen im Zweifel ganz weglassen.
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

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const focus = FOCUS[now.getUTCDay()];
  const client = new Anthropic({ apiKey, timeout: 110_000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DOMAINS = await loadAllowedDomains(FALLBACK_DOMAINS);
  const tools: any[] = [webSearchTool(DOMAINS), REPORT_TOOL];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        `Sammle die wichtigsten Bundesliga-News (Stand ${today}) und rufe report_news auf.\n` +
        `HEUTIGER SCHWERPUNKT (zusätzlich zu den Top-Meldungen besonders gründlich): ${focus}.`,
    },
  ];
  // Prompt-Caching: System-Prompt, Tool-Definitionen und die bereits
  // gelaufenen pause_turn-Runden sind ein stabiler Prefix — ohne
  // cache_control wird er bei JEDER Runde voll bezahlt. Das Top-Level-Feld
  // setzt den Breakpoint automatisch ans Ende des cachebaren Teils, was bei
  // einer waehrend des Laufs wachsenden Konversation genau passt.
  const baseParams = () => ({
    model: MODEL,
    max_tokens: 8000,
    // Niedrige Denktiefe: weniger und gebuendeltere Suchen, kuerzere Zwischen-
    // texte. Fuer "sammeln und strukturieren" reicht das.
    output_config: { effort: "low" as const },
    cache_control: { type: "ephemeral" as const },
    system: SYSTEM(DOMAINS),
    tools,
    messages,
  });

  // Ohne Messung war nicht sichtbar, was ein Lauf kostet — bis das Guthaben
  // leer war. Wird mitgezaehlt und in der Antwort zurueckgegeben.
  const cost = { calls: 0, in: 0, out: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
  const track = (r: Anthropic.Message) => {
    const u = r.usage as Anthropic.Usage & {
      server_tool_use?: { web_search_requests?: number };
    };
    cost.calls += 1;
    cost.in += u.input_tokens ?? 0;
    cost.out += u.output_tokens ?? 0;
    cost.cacheWrite += u.cache_creation_input_tokens ?? 0;
    cost.cacheRead += u.cache_read_input_tokens ?? 0;
    cost.searches += u.server_tool_use?.web_search_requests ?? 0;
  };

  try {
    let response;
    try {
      response = await client.messages.create(baseParams());
    } catch (e) {
      // Self-Healing: blockierte Domain(s) aus der Whitelist werfen, 1× retry.
      if (!pruneBlockedDomains(tools, e)) throw e;
      response = await client.messages.create(baseParams());
    }
    track(response);
    let guard = 0;
    while (response.stop_reason === "pause_turn" && guard++ < 6) {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create(baseParams());
      track(response);
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
        impact?: number;
        summary?: string;
        source?: string;
      })
      .filter((s) => s.summary && typeSet.has(s.type as NewsType))
      .map((s) => {
        // Platzhalter-Spielernamen ("-", "n/a", …) → null; Zitier-Markup aus
        // Web-Search-Antworten aus dem Summary strippen.
        const player = s.player && s.player.replace(/[^\p{L}\p{N}]/gu, "").length >= 3
          ? s.player.trim()
          : undefined;
        s.player = player;
        s.summary = s.summary!.replace(/<\/?cite[^>]*>/g, "").trim();
        const clubCode = s.club ? canon(s.club) : null;
        const type = s.type as NewsType;
        const durable = s.durable ?? DURABLE_TYPES.includes(type);
        // Impact mit Code-Leitplanken: Modellwert clampen; 'other' ohne Spieler
        // kann nie mehr als "mittel" sein; Verletzung/Transfer MIT Spieler nie
        // weniger als "hoch".
        let impact = Math.min(4, Math.max(1, Math.round(s.impact ?? 2)));
        if (type === "other" && !s.player) impact = Math.min(impact, 2);
        if (s.player && ["injury", "transfer_in", "transfer_out", "suspension"].includes(type)) {
          impact = Math.max(impact, 3);
        }
        // Gruppiert dieselbe Story über Tage (Typ + Verein + Spieler/Kern).
        const key = `${type}:${clubCode ?? "x"}:${slug(s.player || s.summary!)}`;
        return {
          news_date: today,
          club: clubCode,
          player: s.player ?? null,
          type,
          durable,
          impact,
          summary: s.summary!,
          source: s.source ?? null,
          dedup_key: key,
        };
      });

    if (!rows.length) return NextResponse.json({ inserted: 0 });
    let { error, count } = await supabase
      .from("news_log")
      .upsert(rows, { onConflict: "dedup_key", count: "exact" });
    if (error && /impact/.test(error.message)) {
      // DB noch ohne impact-Spalte (ALTER aus schema.sql fehlt) → ohne Feld
      // schreiben, damit der Cron nie ausfällt.
      const legacy = rows.map(({ impact: _i, ...rest }) => rest);
      ({ error, count } = await supabase
        .from("news_log")
        .upsert(legacy, { onConflict: "dedup_key", count: "exact" }));
    }
    if (error) {
      return NextResponse.json({ error: `DB: ${error.message}` }, { status: 502 });
    }
    const usd =
      (cost.in * PRICE_IN + cost.cacheWrite * PRICE_IN * 1.25 + cost.cacheRead * PRICE_IN * 0.1 +
        cost.out * PRICE_OUT) / 1e6 +
      cost.searches * 0.01;
    console.log(
      `[collect-news] ${cost.calls} Calls · in ${cost.in} · cacheW ${cost.cacheWrite} ` +
        `· cacheR ${cost.cacheRead} · out ${cost.out} · ${cost.searches} Suchen · ~$${usd.toFixed(3)}`,
    );
    return NextResponse.json({
      inserted: count ?? rows.length,
      model: MODEL,
      cost: { ...cost, usd: Number(usd.toFixed(3)) },
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json(
      { error: `Sammeln fehlgeschlagen: ${err.message ?? "unbekannt"}` },
      { status: err.status && err.status < 500 ? 400 : 502 },
    );
  }
}
