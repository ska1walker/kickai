"""
kicker Managerspiel Interactive — Scoring Engine
=================================================
Bildet die offizielle Punktelogik 1:1 ab (Stand Regelwerk 2024/25+).
Quelle: kicker.de Spielregeln Managerspiel Interactive.

Diese Engine ist die "Wahrheit": Egal ob die Spielerdaten aus einer
Simulation, aus OpenLigaDB+manuellen Noten oder aus einem echten
Saison-Export kommen — die Punktberechnung ist immer dieselbe.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum


class Position(str, Enum):
    TW = "TW"   # Torwart
    ABW = "ABW" # Abwehr
    MF = "MF"   # Mittelfeld
    ST = "ST"   # Sturm


# --- Note -> Punkte (offizielle Tabelle) ---
# 1.0->10, 1.5->8, 2.0->6, 2.5->4, 3.0->2, 3.5->0,
# 4.0->-2, 4.5->-4, 5.0->-6, 5.5->-8, 6.0->-10
def note_to_points(note: float | None) -> int:
    """Wandelt eine kicker-Note in Punkte. None = keine Bewertung (zu kurz gespielt)."""
    if note is None:
        return 0
    # lineare Formel die exakt die Tabelle trifft: P = (3.5 - note) * 4
    return round((3.5 - note) * 4)


# --- Tor-Punkte je Position ---
GOAL_POINTS = {
    Position.TW: 6,
    Position.ABW: 5,
    Position.MF: 4,
    Position.ST: 3,
}

START_POINTS = 4        # Startaufstellung
SUB_POINTS = 2          # Einwechslung
# Verifiziert an Spieltag 1 der Saison 26/27: 16 Spieler ueber alle Vereine
# und Positionen hinweg lagen exakt +2 ueber "Start + Note", der +1-Bereich
# war praktisch leer. Frueher stand hier 1 — das war falsch.
ASSIST_POINTS = 2
CLEAN_SHEET_GK_POINTS = 2   # TW spielt komplett zu null
MOTM_POINTS = 3             # Spieler des Spiels
YELLOW_RED = -3
RED = -6


@dataclass
class PlayerMatchPerformance:
    """Was ein Spieler an EINEM Spieltag tatsächlich gemacht hat."""
    name: str
    position: Position
    started: bool = False          # in der Startelf des realen Vereins?
    came_on: bool = False          # eingewechselt?
    minutes: int = 0
    note: float | None = None      # kicker-Note (None wenn keine)
    goals: int = 0
    assists: int = 0
    clean_sheet: bool = False      # nur relevant für TW, komplettes Spiel zu null
    motm: bool = False
    yellow_red: bool = False
    red: bool = False

    @property
    def played(self) -> bool:
        return self.started or self.came_on


def score_performance(p: PlayerMatchPerformance, lineup_slot: str) -> int:
    """
    Berechnet die kicker-Manager-Punkte EINES Spielers an EINEM Spieltag,
    abhängig davon, wie ICH ihn aufgestellt habe.

    lineup_slot: "start"  -> ich hatte ihn in meiner Startelf
                 "bench"  -> ich hatte ihn auf der Bank
                 "out"    -> gar nicht im Aufgebot
    """
    if lineup_slot != "start":
        return 0  # NUR die eigene Startelf zählt im Managerspiel

    pts = 0
    # Grundpunkte für Einsatz
    if p.started:
        pts += START_POINTS
    elif p.came_on:
        pts += SUB_POINTS
    else:
        # Aufgestellt, aber real nicht eingesetzt -> 0 Punkte. Der Kardinalfehler.
        return 0

    # Note
    pts += note_to_points(p.note)
    # Tore
    pts += p.goals * GOAL_POINTS[p.position]
    # Assists
    pts += p.assists * ASSIST_POINTS
    # Zu null (nur TW, komplettes Spiel)
    if p.position == Position.TW and p.clean_sheet:
        pts += CLEAN_SHEET_GK_POINTS
    # Spieler des Spiels
    if p.motm:
        pts += MOTM_POINTS
    # Karten
    if p.red:
        pts += RED
    elif p.yellow_red:
        pts += YELLOW_RED

    return pts


if __name__ == "__main__":
    # Mini-Selbsttest gegen die offizielle Tabelle
    assert note_to_points(1.0) == 10
    assert note_to_points(2.0) == 6
    assert note_to_points(3.5) == 0
    assert note_to_points(6.0) == -10
    assert note_to_points(None) == 0

    # Innenverteidiger: Note 2.0 (6) + Standardtor (5) + Start (4) = 15
    iv = PlayerMatchPerformance("Test-IV", Position.ABW, started=True, minutes=90, note=2.0, goals=1)
    assert score_performance(iv, "start") == 15, score_performance(iv, "start")

    # Stürmer mit Tor aber schwacher Note 4.0 (-2) + Tor (3) + Start (4) = 5
    st = PlayerMatchPerformance("Test-ST", Position.ST, started=True, minutes=90, note=4.0, goals=1)
    assert score_performance(st, "start") == 5, score_performance(st, "start")

    # Spieler aufgestellt, aber nicht gespielt -> 0
    dnp = PlayerMatchPerformance("Bank", Position.MF, started=False, came_on=False)
    assert score_performance(dnp, "start") == 0

    print("Scoring-Engine: alle Selbsttests bestanden ✓")
    print(f"  IV mit Standardtor + Note 2.0 = {score_performance(iv,'start')} Pkt")
    print(f"  ST mit Tor aber Note 4.0      = {score_performance(st,'start')} Pkt")
    print("  -> Der IV bringt 3x so viel wie der teurere Stürmer. Das ist die These.")
