// Saison-Import: zieht die kicker-CSV (Archiv-URL) ODER nimmt eine hochgeladene
// CSV, parst sie, löst Vereine auf, bridged optional Vorsaisonpunkte und schreibt
// den Pool nach Supabase (player_pool). Geschützt durch die Login-Middleware.
import { NextRequest, NextResponse } from "next/server";
import { canon } from "@/lib/engine/clubs";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import bundled2025 from "@/lib/data/players-2025.json";

export const runtime = "nodejs";
export const maxDuration = 60;

const POSMAP: Record<string, string> = {
  GOALKEEPER: "TW",
  DEFENDER: "ABW",
  MIDFIELDER: "MF",
  FORWARD: "ST",
};

interface Row {
  season: number;
  id: string;
  name: string;
  club: string;
  club_name: string;
  position: string;
  mv: number;
  points: number;
  exp_points: number;
  has_history: boolean | null;
  est_points: number | null;
}

// Punkte ≈ a + b·Marktwert, je Position auf den Spielern MIT Historie gefittet.
// Für Spieler ohne Vorsaison-Daten ist der Marktwert der einzige belastbare
// Anhaltspunkt — bewusst mit Abschlag, weil er die Investition zeigt, nicht die
// Einsatzzeit. Bestätigen muss ihn die Vorbereitung/News-Recherche.
const EST_DISCOUNT = 0.79; // kalibriert an 3 Saisonübergängen (0.84/0.72/0.81)
function fitMvModel(rows: { position: string; mv: number; points: number }[]) {
  const model: Record<string, [number, number]> = {};
  for (const pos of ["TW", "ABW", "MF", "ST", "*"]) {
    const sub = rows.filter((r) => r.points > 0 && (pos === "*" || r.position === pos));
    if (sub.length < 8) continue;
    const mx = sub.reduce((s, r) => s + r.mv, 0) / sub.length;
    const my = sub.reduce((s, r) => s + r.points, 0) / sub.length;
    const den = sub.reduce((s, r) => s + (r.mv - mx) ** 2, 0);
    if (!den) continue;
    const b = sub.reduce((s, r) => s + (r.mv - mx) * (r.points - my), 0) / den;
    model[pos] = [my - b * mx, b];
  }
  return model;
}
function estimatePoints(
  mv: number,
  pos: string,
  model: Record<string, [number, number]>,
): number {
  const [a, b] = model[pos] ?? model["*"] ?? [0, 0];
  return Math.max(0, Math.round((a + b * mv) * EST_DISCOUNT));
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0].split(";").map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = l.split(";");
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = (cells[i] ?? "").trim()));
    return o;
  });
}

export async function POST(req: NextRequest) {
  if (!supabaseEnabled || !supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert." }, { status: 501 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    season?: number;
    source?: "url" | "upload";
    csv?: string;
    preseason?: boolean;
    reference?: number;
  };
  const season = Number(body.season);
  if (!season) return NextResponse.json({ error: "season nötig." }, { status: 400 });

  // CSV beschaffen.
  let text: string;
  if (body.source === "upload") {
    if (!body.csv?.trim()) return NextResponse.json({ error: "Keine CSV übergeben." }, { status: 400 });
    text = body.csv;
  } else {
    const url = `https://www.kicker-libero.de/api/sportsdata/v1/players-details/se-k0001${season}.csv`;
    const res = await fetch(url, { headers: { "User-Agent": "kick-ai/1.0" }, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `kicker-Abruf HTTP ${res.status} (Saison ${season} evtl. noch nicht verfügbar).` },
        { status: 502 },
      );
    }
    text = await res.text();
  }

  const parsed = parseCsv(text);
  if (!parsed.length) return NextResponse.json({ error: "CSV leer/ungültig." }, { status: 400 });

  // Referenz-Punkte für die Bridge.
  let refPoints: Record<string, number> = {};
  if (body.preseason && body.reference) {
    const { data } = await supabase
      .from("player_pool")
      .select("id,points")
      .eq("season", body.reference);
    if (data && data.length) {
      refPoints = Object.fromEntries(data.map((r) => [r.id, Number(r.points)]));
    } else if (body.reference === 2025) {
      refPoints = Object.fromEntries(
        (bundled2025 as { id: string; points: number }[]).map((p) => [p.id, p.points]),
      );
    }
  }

  const rows: Row[] = [];
  const unresolved = new Set<string>();
  for (const r of parsed) {
    const id = r["ID"];
    const verein = r["Verein"];
    if (!id || !verein) continue;
    const mv = Number(r["Marktwert"]) / 1e6;
    if (!(mv > 0) || mv >= 100) continue; // Sentinel 999 / ungültig
    const code = canon(verein);
    if (!code) unresolved.add(verein);
    let points = Number(r["Punkte"]) || 0;
    let hasHistory: boolean | null = null;
    if (body.preseason) {
      // kicker befüllt die neue Saison mit Vorsaison-Punkten vor — auch für
      // Rückkehrer ohne Referenz-Eintrag. Referenz zuerst, sonst CSV-Wert.
      const csvPts = points;
      hasHistory = id in refPoints || csvPts > 0;
      points = refPoints[id] ?? csvPts;
    }
    rows.push({
      season,
      id,
      name: r["Angezeigter Name (kurz)"] || r["Nachname"] || id,
      club: code ?? "?",
      club_name: verein,
      position: POSMAP[r["Position"]] ?? "?",
      mv: Math.round(mv * 10) / 10,
      points,
      exp_points: Math.round((points / 34) * 100) / 100,
      has_history: hasHistory,
      est_points: null,
    });
  }
  if (!rows.length) return NextResponse.json({ error: "Keine gültigen Zeilen." }, { status: 400 });

  // Marktwert-Schätzung für alle ohne Historie (Modell aus derselben Datei).
  if (body.preseason) {
    const model = fitMvModel(rows);
    for (const r of rows) {
      if (!r.has_history) r.est_points = estimatePoints(r.mv, r.position, model);
    }
  }

  // Saison ersetzen: alte Zeilen weg, neue rein (in Chunks).
  await supabase.from("player_pool").delete().eq("season", season);
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from("player_pool").insert(rows.slice(i, i + 200));
    if (error) return NextResponse.json({ error: `DB: ${error.message}` }, { status: 502 });
  }

  return NextResponse.json({
    season,
    count: rows.length,
    bridged: body.preseason ? rows.filter((r) => r.has_history).length : undefined,
    unresolvedClubs: [...unresolved],
  });
}
