"""
OpenLigaDB-Client
=================
Holt Bundesliga-Spielplan, Anstoßzeiten und (nach Abpfiff) Tore/Ergebnisse.
Gratis, keine Auth, ODbL-Lizenz. Basis für den produktiven Spieltags-Workflow:
- Wer spielt an diesem Spieltag WANN? (Micromanagement-Fenster pro Spieler)
- Spielt der Verein eines Kaderspielers überhaupt? (sonst automatisch "out")

Endpoints:
  getmatchdata/bl1/<saison>/<spieltag>   -> Spiele eines Spieltags
  getcurrentgroup/bl1                    -> aktueller Spieltag
Saison = Startjahr (2025 = Saison 2025/26).
"""
from __future__ import annotations
import json
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime

from clubs import canon

BASE = "https://api.openligadb.de"


@dataclass
class Fixture:
    home: str                 # kanonischer Code
    away: str
    home_name: str            # Anzeigename (OLDB)
    away_name: str
    kickoff: datetime | None  # lokale Anstoßzeit
    finished: bool
    match_id: int
    goal_scorers: list[str] = field(default_factory=list)  # Namen (nach Spiel)

    def involves(self, club_code: str) -> bool:
        return club_code in (self.home, self.away)


def _get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "kick-ai/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def get_matchday(season: int, matchday: int) -> list[Fixture]:
    """Alle Spiele eines Spieltags als Fixture-Liste."""
    data = _get(f"{BASE}/getmatchdata/bl1/{season}/{matchday}")
    fixtures = []
    for m in data:
        scorers = [g.get("goalGetterName", "").strip()
                   for g in (m.get("goals") or [])
                   if g.get("goalGetterName") and not g.get("isOwnGoal")]
        fixtures.append(Fixture(
            home=canon(m["team1"]["teamName"]),
            away=canon(m["team2"]["teamName"]),
            home_name=m["team1"]["teamName"],
            away_name=m["team2"]["teamName"],
            kickoff=_parse_dt(m.get("matchDateTime")),
            finished=bool(m.get("matchIsFinished")),
            match_id=m["matchID"],
            goal_scorers=scorers,
        ))
    return fixtures


def get_current_matchday(season_hint: int | None = None) -> tuple[int, int]:
    """(Saison-Startjahr, Spieltag) des aktuellen Spieltags laut OLDB."""
    g = _get(f"{BASE}/getcurrentgroup/bl1")
    matchday = g.get("groupOrderID")
    # Saison aus einem Match des Spieltags ableiten wäre teuer; OLDB liefert
    # sie nicht direkt in getcurrentgroup -> Hint nutzen oder Aufrufer setzt sie.
    return season_hint, matchday


def fixture_for_club(fixtures: list[Fixture], club_code: str) -> Fixture | None:
    for f in fixtures:
        if f.involves(club_code):
            return f
    return None


if __name__ == "__main__":
    print("Aktueller Spieltag (OLDB):", get_current_matchday()[1])
    fx = get_matchday(2024, 1)
    print(f"\nBL1 2024/25, 1. Spieltag — {len(fx)} Spiele:")
    for f in sorted(fx, key=lambda x: x.kickoff or datetime.max):
        ko = f.kickoff.strftime("%a %d.%m %H:%M") if f.kickoff else "?"
        res = f" | Tore: {', '.join(f.goal_scorers)}" if f.finished else ""
        print(f"  {ko}  {f.home:<11} vs {f.away:<11}{res}")
