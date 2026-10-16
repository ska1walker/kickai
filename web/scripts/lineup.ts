// Spieltags-Aufstellung fuer die Freitags-Routine (seit 09.10.2026).
//
// Rechnet mit DEMSELBEN Optimierer wie /matchday (src/lib/engine/optimizer.ts:
// Status-Gewichtung, Heimvorteil, Gegnerstaerke, Gleichstandsregel nach
// Anstoss), nur ohne Browser. Neu gegenueber der App ist allein die
// Erwartung je Spieler: Vorsaison und laufende Saison werden gemischt (siehe
// blend()). Das Ergebnis wird nach Supabase zurueckgeschrieben
// (squad_players.exp_points), damit /matchday exakt dieselbe Elf zeigt.
//
//   cd web && NODE_USE_ENV_PROXY=1 npx tsx scripts/lineup.ts [--matchday N]
//       [--status status.json] [--dry-run] [--due-hours 36]
//
// --due-hours H: nur pruefen, ob der naechste Spieltag in den naechsten H
// Stunden ANFAENGT (erster Anstoss in der Zukunft und <= H Stunden). Exit 0 =
// faellig, Exit 3 = nicht faellig. So kann die Routine taeglich laufen und
// erwischt auch englische Wochen, ohne an Spieltagen doppelt zu arbeiten.
//
// status.json: { "Spielername": "start" | "doubt" | "bench" | "out", ... }
// — Namen wie in squad_players. Wird fuer ALLE Kaderspieler geschrieben;
// wer fehlt, bekommt "doubt" (wie in der App: unbekannt = fraglich).
//
// Netz: Supabase-Header setzt der Proxy der Cloud-Umgebung; ausserhalb davon
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY setzen.
// OpenLigaDB liefert Anstosszeiten als deutsche Ortszeit ohne Zone. Damit
// Date.parse und die Ausgabe stimmen, rechnet das Skript in Berliner Zeit —
// egal, in welcher Zeitzone der Container laeuft.
process.env.TZ = "Europe/Berlin";
import { readFileSync } from "node:fs";
import { getMatchday, getCurrentMatchday } from "../src/lib/engine/openligadb";
import { joinFixtures, optimize, type PlayerState } from "../src/lib/engine/optimizer";
import { clubStrength } from "../src/lib/engine/context";
import { CLUB_LABEL } from "../src/lib/engine/clubs";
import type { Fixture, Position, SquadPlayer, Status } from "../src/lib/engine/types";
import { STATUS_WEIGHT } from "../src/lib/engine/types";
import { POOL, effectivePoints, isEstimated } from "../src/lib/data/pool";
import { DEFAULT_SEASON } from "../src/lib/data/squad";

const SEASON = DEFAULT_SEASON;
const SB = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://llagnybrzybbkeidqtzc.supabase.co")
  .replace(/\/$/, "") + "/rest/v1";
// Oeffentlicher anon-Key (Client-Bundle, supabase-keepalive.yml). Fallback,
// seit am 16.10.2026 das Proxy-Secret der Cloud-Umgebung nicht mehr griff.
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsYWdueWJyenliYmtlaWRxdHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4Njk2OTEsImV4cCI6MjA5ODQ0NTY5MX0.S7fBWF5TVEoqU0WgB2htOyl5EgnT4UX9H8oKG_D9iN8";
const CSV = `https://www.kicker-libero.de/api/sportsdata/v1/players-details/se-k0001${SEASON}.csv`;
const STATUSES: Status[] = ["start", "doubt", "bench", "out"];

// --- Erwartung: Vorsaison + laufende Saison ------------------------------
//
// Bisher galt nur die Vorsaison (Punkte/34). Das ist fuer Spieler ohne
// Historie grob falsch: ter Horst (Aufsteiger) stand mit 0,79 drin, holt
// aber jede Woche Startelfpunkte. Die laufende Saison misst genau das, was
// zaehlt — Einsatzzeit (Befund 2) —, ist am Anfang aber verrauscht.
//
// Deshalb ein Schrumpfschaetzer: die Vorsaison zaehlt wie PRIOR_GAMES
// Spieltage, die aktuelle Saison mit ihren tatsaechlich gespielten Spielen.
//   erwartet = (vorsaison_je_spiel * k + saisonpunkte) / (k + spiele)
// k = 5 bei echter Vorsaison: nach 5 Spieltagen halb/halb. k = 2, wenn der
// Vorsaisonwert nur eine Marktwert-Schaetzung ist (isEstimated).
// ANNAHME, nicht gemessen — im Messprotokoll gegenpruefen, bevor daran
// gedreht wird (Auswertungsregel in CLAUDE.md).
const PRIOR_GAMES = 5;
const PRIOR_GAMES_ESTIMATED = 2;

function blend(prior: number, k: number, seasonPts: number | undefined, games: number): number {
  if (seasonPts == null || games <= 0) return prior;
  return (prior * k + seasonPts) / (k + games);
}

// --- Netz -----------------------------------------------------------------

function sbHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  h.apikey = ANON_KEY;
  h.Authorization = `Bearer ${ANON_KEY}`;
  return h;
}

async function sb<T>(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
  const res = await fetch(SB + path, {
    method,
    headers: sbHeaders(extra),
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function seasonPoints(): Promise<Map<string, number>> {
  const res = await fetch(CSV);
  if (!res.ok) throw new Error(`kicker-CSV ${res.status}`);
  const lines = (await res.text()).trim().split(/\r?\n/);
  const head = lines[0].split(";");
  const iId = head.indexOf("ID");
  const iPts = head.indexOf("Punkte");
  const out = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const c = line.split(";");
    out.set(c[iId], Number(c[iPts]) || 0);
  }
  return out;
}

/** Abgeschlossene Spiele je Verein VOR dem Spieltag (Nachholspiele zaehlen
 *  mit, ausgefallene nicht). */
async function gamesPlayed(matchday: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let md = 1; md < matchday; md++) {
    for (const f of await getMatchday(SEASON, md)) {
      if (!f.finished) continue;
      for (const c of [f.home, f.away]) if (c) out.set(c, (out.get(c) ?? 0) + 1);
    }
  }
  return out;
}

/** Naechster Spieltag, der noch nicht komplett gespielt ist. */
async function nextMatchday(): Promise<number> {
  const cur = (await getCurrentMatchday()) ?? 1;
  const fx = await getMatchday(SEASON, cur);
  return fx.length && fx.every((f) => f.finished) ? cur + 1 : cur;
}

// --- Ausgabe --------------------------------------------------------------

const fmtKick = (iso: string | null) => {
  if (!iso) return "?";
  // OpenLigaDB liefert Ortszeit ohne Zone.
  const d = new Date(iso);
  const tag = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  return `${tag} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const r1 = (x: number) => x.toFixed(1).replace(".", ",");
const POS_ORDER: Record<Position, number> = { TW: 0, ABW: 1, MF: 2, ST: 3 };

function venue(p: PlayerState): string {
  if (!p.fixture) return "kein Spiel";
  const home = p.fixture.home === p.club;
  const opp = home ? p.fixture.away : p.fixture.home;
  return `${home ? "vs" : "@"} ${opp ? CLUB_LABEL[opp] ?? opp : "?"}`;
}

// --- Hauptlauf ------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const dry = args.includes("--dry-run");
  const matchday = arg("--matchday") ? Number(arg("--matchday")) : await nextMatchday();

  const due = arg("--due-hours");
  if (due) {
    const kicks = (await getMatchday(SEASON, matchday))
      .map((f) => (f.kickoff ? Date.parse(f.kickoff) : NaN))
      .filter((t) => !Number.isNaN(t));
    const first = Math.min(...kicks);
    const hours = (first - Date.now()) / 3.6e6;
    const ok = hours > 0 && hours <= Number(due);
    console.log(`Spieltag ${matchday}: erster Anstoss ${fmtKick(new Date(first).toISOString())}, ` +
      `in ${hours.toFixed(1)} h → ${ok ? "FAELLIG" : "nicht faellig"}`);
    process.exit(ok ? 0 : 3);
  }

  type Row = { id: string; name: string; club: string; position: Position; mv: number | null };
  const squadRows = await sb<Row[]>("GET", "/squad_players?select=id,name,club,position,mv");
  const byName = new Map(squadRows.map((r) => [r.name, r]));

  // 1. Status schreiben (optional)
  const statusFile = arg("--status");
  if (statusFile) {
    const given = JSON.parse(readFileSync(statusFile, "utf8")) as Record<string, string>;
    const unknown = Object.keys(given).filter((n) => !byName.has(n));
    if (unknown.length) throw new Error(`Unbekannte Spieler in ${statusFile}: ${unknown.join(", ")}`);
    const bad = Object.entries(given).filter(([, s]) => !STATUSES.includes(s as Status));
    if (bad.length) throw new Error(`Ungueltiger Status: ${bad.map(([n, s]) => `${n}=${s}`).join(", ")}`);
    const now = new Date().toISOString();
    const rows = squadRows.map((r) => ({
      season: SEASON,
      matchday,
      player_id: r.id,
      status: (given[r.name] as Status) ?? "doubt",
      updated_at: now,
    }));
    if (!dry) {
      await sb("POST", "/matchday_status?on_conflict=season,matchday,player_id", rows, {
        Prefer: "resolution=merge-duplicates,return=minimal",
      });
    }
    console.log(`Status Spieltag ${matchday}: ${rows.length} Spieler ${dry ? "(dry-run)" : "geschrieben"}`);
  }

  // 2. Daten
  const [fixtures, pts, games, statusRows] = await Promise.all([
    getMatchday(SEASON, matchday),
    seasonPoints(),
    gamesPlayed(matchday),
    sb<{ player_id: string; status: Status }[]>(
      "GET", `/matchday_status?select=player_id,status&season=eq.${SEASON}&matchday=eq.${matchday}`),
  ]);
  const poolById = new Map(POOL.map((p) => [p.id, p]));
  const statusById = new Map(statusRows.map((s) => [s.player_id, s.status]));

  // 3. Erwartung je Spieler
  const detail = new Map<string, { prior: number; k: number; pts?: number; games: number }>();
  const squad: SquadPlayer[] = squadRows.map((r) => {
    const pool = poolById.get(r.id);
    const prior = pool ? effectivePoints(pool) / 34 : 0;
    const k = pool && isEstimated(pool) ? PRIOR_GAMES_ESTIMATED : PRIOR_GAMES;
    const g = games.get(r.club) ?? 0;
    const p = pts.get(r.id);
    detail.set(r.name, { prior, k, pts: p, games: g });
    return {
      id: r.id, name: r.name, club: r.club, position: r.position,
      mv: r.mv ?? undefined,
      expPoints: Math.round(blend(prior, k, p, g) * 100) / 100,
    };
  });

  // 4. Optimieren — exakt wie /matchday
  const statusMap: Record<string, Status> = {};
  for (const r of squadRows) {
    const s = statusById.get(r.id);
    if (s) statusMap[r.name] = s;
  }
  const players = joinFixtures(squad, fixtures as Fixture[], statusMap, clubStrength(POOL));
  const res = optimize(players);
  if ("error" in res) throw new Error(res.error);

  // 5. Erwartung zurueckschreiben, damit /matchday dieselbe Elf zeigt
  if (!dry) {
    await Promise.all(squad.map((p) =>
      sb("PATCH", `/squad_players?id=eq.${encodeURIComponent(p.id!)}`,
        { exp_points: p.expPoints }, { Prefer: "return=minimal" })));
  }

  // 6. Bericht (Markdown, fuer Routine-Antwort und Spieltagsnotiz)
  const st = new Map(players.map((p) => [p.name, p]));
  const inXI = new Set(res.lineup.map((l) => l.name));
  const line = (p: PlayerState) => {
    const d = detail.get(p.name)!;
    const form = d.pts == null ? "–" : `${d.pts} in ${d.games}`;
    return `| ${p.position} | ${p.name} | ${CLUB_LABEL[p.club] ?? p.club} | ${venue(p)} | ${fmtKick(p.fixture?.kickoff ?? null)} | ${p.status} | ${r1(d.prior)} | ${form} | ${r1(p.expPoints)} | ${(p.context ?? 0) >= 0 ? "+" : ""}${r1(p.context ?? 0)} | ${r1((p.expPoints + (p.context ?? 0)) * STATUS_WEIGHT[p.status])} |`;
  };
  const head = "| Pos | Spieler | Verein | Spiel | Anstoss | Status | Vorsaison/Sp | Saison (Pkt in Sp) | erwartet | Kontext | Wert |\n|---|---|---|---|---|---|---:|---:|---:|---:|---:|";
  const xi = res.lineup.map((l) => st.get(l.name)!);
  const bench = players.filter((p) => !inXI.has(p.name))
    .sort((a, b) => POS_ORDER[a.position] - POS_ORDER[b.position] || b.expPoints - a.expPoints);

  console.log(`\n## Empfehlung Spieltag ${matchday}: ${res.formation} — ${r1(res.expectedPoints)} Punkte erwartet\n`);
  console.log(head);
  for (const p of xi) console.log(line(p));
  console.log(`\n### Bank\n\n${head}`);
  for (const p of bench) console.log(line(p));
  console.log("\n### Ersatz, falls kurzfristig raus (nur spaetere Anstoesse)\n");
  for (const c of res.coverage) {
    console.log(`- ${c.name} (${fmtKick(c.kickoff)}): ${c.backups.length ? c.backups.join(", ") : "**kein Ersatz mehr**"}`);
  }
  if (res.warnings.length) {
    console.log("\n### Hinweise\n");
    for (const w of res.warnings) console.log(`- ${w}`);
  }
  console.log(`\n_Wert = (erwartet + Kontext) × Statusgewicht (start 1 / doubt 0,55 / bench 0,2). ` +
    `Erwartet = (Vorsaison × k + Saisonpunkte) / (k + Spiele), k = ${PRIOR_GAMES} ` +
    `(${PRIOR_GAMES_ESTIMATED} bei geschaetzter Vorsaison). Kontext = Heimrecht ±0,25 + Gegnerstaerke._`);
  if (dry) console.log("\n(dry-run: nichts nach Supabase geschrieben)");
}

main().catch((e) => {
  console.error(`FEHLER: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
