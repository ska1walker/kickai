// Status-Persistenz: Supabase falls konfiguriert, sonst LocalStorage.
// Gleiche Idee wie engine/status_editor.py: pro Spieltag speichern, Vorwoche
// als Startpunkt übertragen.
"use client";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import type { Status } from "@/lib/engine/types";

export type StatusMap = Record<string, Status>; // playerId → status

const lsKey = (season: number, md: number) => `kickai:status:${season}:${md}`;

export async function loadStatus(season: number, md: number): Promise<StatusMap> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase
      .from("matchday_status")
      .select("player_id,status")
      .eq("season", season)
      .eq("matchday", md);
    const map: StatusMap = {};
    (data ?? []).forEach((r) => (map[r.player_id] = r.status as Status));
    return map;
  }
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(lsKey(season, md));
  return raw ? (JSON.parse(raw) as StatusMap) : {};
}

/** Aktueller Spieltag, sonst Übertrag aus dem Vorspieltag als Startpunkt. */
export async function loadStatusWithCarryover(
  season: number,
  md: number,
): Promise<{ map: StatusMap; carriedFrom: number | null }> {
  const cur = await loadStatus(season, md);
  if (Object.keys(cur).length > 0) return { map: cur, carriedFrom: null };
  if (md > 1) {
    const prev = await loadStatus(season, md - 1);
    if (Object.keys(prev).length > 0) return { map: prev, carriedFrom: md - 1 };
  }
  return { map: {}, carriedFrom: null };
}

export async function saveStatus(
  season: number,
  md: number,
  map: StatusMap,
): Promise<void> {
  if (supabaseEnabled && supabase) {
    const rows = Object.entries(map).map(([player_id, status]) => ({
      season,
      matchday: md,
      player_id,
      status,
    }));
    if (rows.length) await supabase.from("matchday_status").upsert(rows);
    return;
  }
  if (typeof window === "undefined") return;
  window.localStorage.setItem(lsKey(season, md), JSON.stringify(map));
}
