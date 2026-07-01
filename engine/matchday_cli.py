"""
Spieltags-CLI — das produktive Werkzeug
=======================================
Führt alles zusammen und beantwortet die eine Frage pro Spieltag:
"Welche 11 stelle ich auf, und bis wann muss ich welche Entscheidung fällen?"

Pipeline:
  1. Kader laden (data/squad.json)               -> Spieler + erwartete Punkte
  2. Spielplan von OpenLigaDB holen              -> wer spielt WANN
  3. Join: spielt der Verein? Anstoßzeit?        -> Micromanagement-Fenster
     - Verein hat kein Spiel  -> Status automatisch "out"
  4. Status anwenden (aus --status JSON oder Default)
  5. Optimierer -> beste Formation + Startelf
  6. Ausgabe: Elf + nach Anstoß sortierte Deadline-Timeline + Warnungen

Aufruf:
  python matchday_cli.py --squad ../data/squad.example.json \
                         --season 2025 --matchday 1 \
                         [--status ../data/status.example.json]

Status-JSON: {"Kramaric": "start", "Coufal": "doubt", "Kane": "out", ...}
Werte: start / doubt / bench / out. Fehlt ein Spieler -> Default "doubt".
Kein Auto-Aufstellen im kicker — dies EMPFIEHLT nur, Kai klickt selbst.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from openligadb import get_matchday, fixture_for_club, Fixture
from squad import load_squad
from matchday_optimizer import optimize_matchday, print_result
from status_editor import (edit_status_interactive, load_saved_status,
                           save_status, print_saved_hint)

WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


def apply_fixtures(squad, fixtures: list[Fixture]) -> dict:
    """Hängt an jeden Spieler sein Fixture (p.fixture) + Anstoß (p.kickoff).
       Spieler ohne Spiel dieses Spieltags -> Status 'out'. Gibt Notizen."""
    notes = {"no_game": [], "unknown_club": []}
    for p in squad:
        club = getattr(p, "club", None)
        if club is None:
            notes["unknown_club"].append(p.name)
            p.fixture = None
            p.kickoff = None
            continue
        fx = fixture_for_club(fixtures, club)
        p.fixture = fx
        p.kickoff = fx.kickoff if fx else None
        if fx is None:
            p.status = "out"
            notes["no_game"].append(p.name)
    return notes


def apply_status(squad, status_map: dict):
    """Setzt den Status je Spieler (nur wenn Verein spielt — 'out' bleibt)."""
    for p in squad:
        if getattr(p, "fixture", None) is None:
            continue  # kein Spiel -> bleibt 'out'
        if p.name in status_map:
            p.status = status_map[p.name]


def kickoff_str(dt: datetime | None) -> str:
    if dt is None:
        return "kein Spiel"
    return f"{WD[dt.weekday()]} {dt.strftime('%d.%m. %H:%M')}"


def print_timeline(squad, lineup_names: set[str]):
    """Nach Anstoß sortierte Deadline-Liste NUR der aufgestellten Spieler:
       zeigt, bis wann Kai jede Aufstellungs-Entscheidung fixieren muss."""
    starters = [p for p in squad if p.name in lineup_names and p.kickoff]
    starters.sort(key=lambda p: p.kickoff)
    print("\n  MICROMANAGEMENT-TIMELINE (Deadline = Anstoß des jeweiligen Spiels):")
    print("  " + "-" * 56)
    last = None
    for p in starters:
        ks = kickoff_str(p.kickoff)
        head = ks if ks != last else " " * len(ks)
        opp = "?"
        if p.fixture:
            opp = (f"{p.fixture.away_name}" if p.fixture.home == p.club
                   else f"@ {p.fixture.home_name}")
        flag = {"start": "✓", "doubt": "⚠", "bench": "↑", "out": "✗"}.get(p.status, "?")
        print(f"  {head:<16} {flag} {p.name:<17} {p.position.value:<4} vs {opp}")
        last = ks


def main():
    ap = argparse.ArgumentParser(description="kicker Spieltags-Optimierer")
    ap.add_argument("--squad", required=True)
    ap.add_argument("--season", type=int, required=True, help="Startjahr, z.B. 2025 = 25/26")
    ap.add_argument("--matchday", type=int, required=True)
    ap.add_argument("--status", help="JSON {name: start/doubt/bench/out}")
    ap.add_argument("-i", "--interactive", action="store_true",
                    help="Status pro Spieler interaktiv abfragen (bequem)")
    args = ap.parse_args()

    squad, sq_warn = load_squad(args.squad)
    print("=" * 60)
    print(f"  SPIELTAG {args.matchday} — Saison {args.season}/{(args.season+1)%100:02d}")
    print("=" * 60)

    try:
        fixtures = get_matchday(args.season, args.matchday)
    except Exception as e:
        print(f"  FEHLER beim Spielplan-Abruf: {e}")
        return
    print(f"  Spielplan geladen: {len(fixtures)} Begegnungen von OpenLigaDB")

    notes = apply_fixtures(squad, fixtures)

    # Ausgangs-Status: gespeicherter Spieltag-Status (Auto), sonst Übertrag aus
    # der Vorwoche, dann optional von --status überschrieben.
    data_dir = os.path.dirname(os.path.abspath(args.squad))
    prefill = load_saved_status(data_dir, args.season, args.matchday)
    if prefill:
        print(f"  Gespeicherter Status geladen ({len(prefill)} Spieler) — nur "
              f"Änderungen pflegen.")
    elif args.matchday > 1:
        prev = load_saved_status(data_dir, args.season, args.matchday - 1)
        if prev:
            prefill = prev
            print(f"  Kein Status für ST {args.matchday} — Übertrag aus "
                  f"ST {args.matchday - 1} ({len(prev)} Spieler) als Startpunkt.")
    if args.status:
        with open(args.status, encoding="utf-8") as f:
            explicit = {k: v for k, v in json.load(f).items()
                        if not k.startswith("_")}
        prefill.update(explicit)
        print(f"  --status überschreibt {len(explicit)} Angaben.")

    if args.interactive:
        status_map = edit_status_interactive(squad, prefill=prefill)
        path = save_status(data_dir, args.season, args.matchday, status_map)
        print_saved_hint(path)
    else:
        if not prefill:
            print("  Kein Status vorhanden → spielende Spieler auf Default "
                  "'doubt'. Tipp: -i für interaktive Pflege.")
        apply_status(squad, prefill)

    res = optimize_matchday(squad)
    print_result(res)

    if "lineup" in res:
        names = {p["name"] for p in res["lineup"]}
        print_timeline(squad, names)

    # Sammel-Warnungen
    if notes["no_game"]:
        print(f"\n  ⓘ Kein Spiel diesen Spieltag (→ nicht aufstellbar): "
              f"{', '.join(notes['no_game'])}")
    if notes["unknown_club"]:
        print(f"  ⚠ Verein nicht erkannt: {', '.join(notes['unknown_club'])}")
    for w in sq_warn:
        print(f"  ⚠ {w}")


if __name__ == "__main__":
    main()
