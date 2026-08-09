// Lädt den Spieler-Pool zur Laufzeit aus Supabase (player_pool) und aktiviert
// ihn. Fällt auf die gebündelte Saison zurück, wenn nichts importiert ist.
// So schaltet der „Daten ziehen"-Button die neue Saison ohne Redeploy scharf.
"use client";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import { setPool, type PoolPlayer } from "./pool";
import { DEFAULT_SEASON } from "./squad";

const SEASON_KEY = "kickai:season";

export function getActiveSeason(): number {
  if (typeof window === "undefined") return DEFAULT_SEASON;
  const v = Number(window.localStorage.getItem(SEASON_KEY));
  return v || DEFAULT_SEASON;
}

export function setActiveSeason(season: number): void {
  if (typeof window !== "undefined") window.localStorage.setItem(SEASON_KEY, String(season));
}

/** Aktiviert den Pool der Saison aus Supabase; gibt die Spielerzahl zurück
 *  (0 = kein Import vorhanden → gebündelte Saison bleibt aktiv). */
export async function loadPool(season: number = getActiveSeason()): Promise<number> {
  if (!supabaseEnabled || !supabase) return 0;
  const { data, error } = await supabase.from("player_pool").select("*").eq("season", season);
  if (error || !data || !data.length) return 0;
  const rows: PoolPlayer[] = data.map((r) => ({
    id: r.id,
    name: r.name,
    club: r.club,
    clubName: r.club_name,
    position: r.position,
    mv: Number(r.mv),
    points: r.points,
    expPoints: Number(r.exp_points),
    hasHistory: r.has_history ?? undefined,
    estPoints: r.est_points ?? undefined,
  }));
  setPool(rows);
  return rows.length;
}
