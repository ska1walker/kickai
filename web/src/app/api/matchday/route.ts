// Server-Route: holt den Spielplan von OpenLigaDB (vermeidet CORS im Browser).
import { NextRequest, NextResponse } from "next/server";
import { getMatchday } from "@/lib/engine/openligadb";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const season = Number(sp.get("season"));
  const matchday = Number(sp.get("matchday"));
  if (!season || !matchday) {
    return NextResponse.json({ error: "season und matchday nötig" }, { status: 400 });
  }
  try {
    const fixtures = await getMatchday(season, matchday);
    return NextResponse.json({ fixtures });
  } catch (e) {
    return NextResponse.json(
      { error: `OpenLigaDB-Abruf fehlgeschlagen: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
