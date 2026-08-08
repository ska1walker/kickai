// Gespeicherte KI-Recherche-Ergebnisse (Team-Tiers, Standard-Schützen).
// Liegen in localStorage, damit sie Reloads überleben und auch der
// Kader-Editor dieselbe Einordnung für seine Begründungen nutzen kann.
"use client";
import type { Tiers } from "@/lib/engine/builder";
import type { SetPieceRole } from "@/lib/engine/strategy";

export const TIERS_KEY = "kickai:tiers";
export const SETPIECES_KEY = "kickai:setpieces";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

export const loadStoredTiers = (): Tiers => read<Tiers>(TIERS_KEY, {});
export const loadStoredSetPieces = (): Record<string, SetPieceRole> =>
  read<Record<string, SetPieceRole>>(SETPIECES_KEY, {});

export function saveStoredTiers(t: Tiers): void {
  window.localStorage.setItem(TIERS_KEY, JSON.stringify(t));
}
export function saveStoredSetPieces(sp: Record<string, SetPieceRole>): void {
  window.localStorage.setItem(SETPIECES_KEY, JSON.stringify(sp));
}
