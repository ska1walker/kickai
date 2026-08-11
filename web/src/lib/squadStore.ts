// Kader-Persistenz: Supabase falls konfiguriert, sonst LocalStorage.
// Fällt auf den Seed-Kader zurück, wenn noch nichts gespeichert ist.
"use client";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import type { SquadPlayer } from "@/lib/engine/types";
import { SEED_SQUAD } from "@/lib/data/squad";

const LS_KEY = "kickai:squad";

export async function loadSquad(): Promise<SquadPlayer[]> {
  if (supabaseEnabled && supabase) {
    const { data } = await supabase.from("squad_players").select("*");
    if (data && data.length) {
      return data.map((r) => ({
        id: r.id,
        name: r.name,
        club: r.club,
        position: r.position,
        expPoints: Number(r.exp_points),
        mv: r.mv != null ? Number(r.mv) : undefined,
      }));
    }
    return SEED_SQUAD;
  }
  if (typeof window === "undefined") return SEED_SQUAD;
  const raw = window.localStorage.getItem(LS_KEY);
  return raw ? (JSON.parse(raw) as SquadPlayer[]) : SEED_SQUAD;
}

/** Doppelte Spieler entfernen. `squad_players.id` ist Primärschlüssel — ein
 *  doppelter Spieler ließ den INSERT fehlschlagen und die Position blieb
 *  unterbesetzt (Symptom: 6 statt 7 Abwehrspieler). */
function dedupe(squad: SquadPlayer[]): SquadPlayer[] {
  const seen = new Set<string>();
  return squad.filter((p) => {
    const key = p.id ?? p.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function saveSquad(squad: SquadPlayer[]): Promise<void> {
  const clean = dedupe(squad);
  if (supabaseEnabled && supabase) {
    await supabase.from("squad_players").delete().neq("id", "");
    if (clean.length) {
      const { error } = await supabase.from("squad_players").insert(
        clean.map((p) => ({
          id: p.id,
          name: p.name,
          club: p.club,
          position: p.position,
          exp_points: p.expPoints,
          mv: p.mv ?? null,
        })),
      );
      if (error) throw new Error(`Kader speichern fehlgeschlagen: ${error.message}`);
    }
    return;
  }
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(clean));
}

export async function resetSquad(): Promise<void> {
  if (supabaseEnabled && supabase) {
    await saveSquad(SEED_SQUAD); // Default zurück in die DB schreiben
    return;
  }
  if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
}
