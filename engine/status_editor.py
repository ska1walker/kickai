"""
Interaktiver Status-Editor
==========================
Macht die Status-Pflege bequem: statt JSON von Hand zu tippen, geht Kai einmal
durch den Kader — pro Spieler mit Gegner, Anstoß und erwartetem Punktwert vor
Augen — und drückt eine Taste (s/d/b/o). Enter behält den bisherigen Wert.

Speichert pro Spieltag nach data/status-<saison>-md<NN>.json und lädt diese
Datei beim nächsten Aufruf automatisch als Ausgangspunkt — so pflegt man von
Woche zu Woche nur die Änderungen.

Spieler ohne Spiel an diesem Spieltag sind bereits 'out' (vom Fixture-Join)
und werden übersprungen.
"""
from __future__ import annotations
import json
import os
import sys

STATUS_KEYS = {"s": "start", "d": "doubt", "b": "bench", "o": "out"}
FLAG = {"start": "✓", "doubt": "⚠", "bench": "↑", "out": "✗"}
POS_ORDER = {"TW": 0, "ABW": 1, "MF": 2, "ST": 3}
WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


def status_path(data_dir: str, season: int, matchday: int) -> str:
    return os.path.join(data_dir, f"status-{season}-md{matchday:02d}.json")


def load_saved_status(data_dir: str, season: int, matchday: int) -> dict:
    """Gespeicherten Status dieses Spieltags laden (leer, wenn keiner da)."""
    p = status_path(data_dir, season, matchday)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
        return {k: v for k, v in d.items() if not k.startswith("_")}
    return {}


def save_status(data_dir: str, season: int, matchday: int, status_map: dict):
    p = status_path(data_dir, season, matchday)
    out = {"_hinweis": f"Status Spieltag {matchday}, Saison {season}/"
                       f"{(season + 1) % 100:02d}. Werte: start/doubt/bench/out."}
    out.update(status_map)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    return p


def _opponent(p) -> str:
    fx = getattr(p, "fixture", None)
    if not fx:
        return "kein Spiel"
    return fx.away_name if fx.home == p.club else f"@ {fx.home_name}"


def _kickoff(p) -> str:
    ko = getattr(p, "kickoff", None)
    return f"{WD[ko.weekday()]} {ko.strftime('%d.%m. %H:%M')}" if ko else "—"


def edit_status_interactive(squad, prefill: dict | None = None) -> dict:
    """Führt Kai durch den Kader. Mutiert p.status und gibt die Status-Map
       {name: status} zurück. prefill = Ausgangswerte (z.B. Vorwoche)."""
    prefill = prefill or {}
    playable = [p for p in squad if getattr(p, "fixture", None) is not None]
    skipped = [p for p in squad if getattr(p, "fixture", None) is None]

    print("\n  STATUS-EDITOR — Taste drücken, Enter behält den Wert in [ ].")
    print("  [s]=start  [d]=doubt  [b]=bench  [o]=out   ·  [x]=Rest behalten & Ende")
    print("  " + "-" * 66)

    status_map = {}
    playable.sort(key=lambda p: (POS_ORDER.get(p.position.value, 9), -p.exp_points))
    quit_rest = False
    for p in playable:
        cur = prefill.get(p.name, p.status)
        if cur not in STATUS_KEYS.values():
            cur = "doubt"
        if quit_rest:
            status_map[p.name] = cur
            p.status = cur
            continue

        line = (f"  {p.position.value:<4} {p.name:<17} {_opponent(p)[:22]:<22} "
                f"{_kickoff(p):<13} ~{p.exp_points:>4.1f}  [{FLAG[cur]} {cur}] > ")
        try:
            raw = input(line).strip().lower()
        except EOFError:
            raw = ""
        if raw == "x":
            quit_rest = True
            raw = ""
        if raw in STATUS_KEYS:
            cur = STATUS_KEYS[raw]
        status_map[p.name] = cur
        p.status = cur

    for p in skipped:
        status_map[p.name] = "out"  # kein Spiel

    return status_map


def print_saved_hint(path: str):
    print(f"  ⓘ Status gespeichert: {os.path.relpath(path)}")


if __name__ == "__main__":
    # Mini-Selbsttest ohne echte Fixtures (Dummy-Objekte)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from matchday_optimizer import SquadPlayer, Pos

    demo = [SquadPlayer("Kramaric", Pos.MF, 8.1, "doubt"),
            SquadPlayer("Kane", Pos.ST, 12.0, "doubt")]
    for p in demo:
        p.fixture = None; p.kickoff = None; p.club = "x"
    print("Nicht-interaktiver Selbsttest (alle ohne Spiel → out):")
    m = edit_status_interactive(demo)
    print(m)
