// Quellen-Whitelist für alle KI-Recherchen (News-Sammler, Scout, Team-Tiers,
// Standardschützen, Spieltags-Status).
//
// Reihenfolge der Wahrheit:
//   1. Tabelle `news_sources` in Supabase — von Kai über /quellen pflegbar
//   2. Env-Variable (pro Route, für Notfälle ohne DB)
//   3. Standardliste im Code
//
// Die Liste geht 1:1 als `allowed_domains` an das Websuche-Werkzeug: Was hier
// nicht steht, wird technisch nicht durchsucht. Bewusst nur deutsche Quellen
// zur 1. Bundesliga, keine Paywall-Inhalte.
import { supabase, supabaseEnabled } from "@/lib/supabase/client";

/** Standardliste — greift, solange keine eigenen Quellen gepflegt sind. */
export const DEFAULT_SOURCES = [
  "kicker.de",
  "ligainsider.de",
  "sport1.de",
  "bundesliga.com",
  "spox.com",
  "ran.de",
  "sport.de",
  "fussballdaten.de",
  "fupa.net",
  "reviersport.de",
  "90min.de",
  "fussballtransfers.com",
  "bulinews.com",
];

/** "https://www.kicker.de/news" → "kicker.de" */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/[^a-z0-9.\-]/g, "");
}

export interface NewsSource {
  domain: string;
  active: boolean;
  note: string | null;
}

/** Aktive Quellen laden. Fällt auf `fallback` zurück, wenn nichts gepflegt ist. */
export async function loadAllowedDomains(fallback: string[] = DEFAULT_SOURCES): Promise<string[]> {
  if (!supabaseEnabled || !supabase) return fallback;
  const { data, error } = await supabase
    .from("news_sources")
    .select("domain,active")
    .eq("active", true);
  if (error || !data?.length) return fallback;
  return data.map((r) => r.domain as string);
}

/** Alle Quellen inkl. deaktivierter — für die Verwaltungsseite. */
export async function loadAllSources(): Promise<NewsSource[]> {
  if (!supabaseEnabled || !supabase) return [];
  const { data } = await supabase
    .from("news_sources")
    .select("domain,active,note")
    .order("domain");
  return (data as NewsSource[]) ?? [];
}
