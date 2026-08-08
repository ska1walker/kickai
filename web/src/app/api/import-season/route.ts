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
    });
  }
  if (!rows.length) return NextResponse.json({ error: "Keine gültigen Zeilen." }, { status: 400 });

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
