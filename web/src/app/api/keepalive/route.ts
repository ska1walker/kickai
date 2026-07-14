// Supabase-Keepalive: minimaler DB-Touch, damit das Free-Tier-Projekt nicht
// nach 7 Tagen Inaktivität pausiert wird. Läuft als eigener Vercel-Cron —
// bewusst unabhängig vom News-Sammler (kein Anthropic-Call, kann also nicht
// an der KI scheitern). Geschützt per CRON_SECRET (Vercel sendet den Bearer).
import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET nicht gesetzt." }, { status: 501 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!supabaseEnabled || !supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert." }, { status: 501 });
  }

  const { count, error } = await supabase
    .from("news_log")
    .select("id", { head: true, count: "exact" });
  if (error) {
    return NextResponse.json({ error: `DB: ${error.message}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, newsCount: count ?? 0 });
}
