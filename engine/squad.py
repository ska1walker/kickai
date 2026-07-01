"""
Kader-Modul
===========
Lädt Kais 22-Mann-Kader aus einer JSON-Datei und reichert jeden Spieler mit
seinem erwarteten Punktwert an — abgeleitet aus einer Referenz-Saison-CSV.

erwarteter Punktwert pro Spieltag = Saisonpunkte / 34.
Bewusst NICHT "Punkte pro Einsatz": Ein Spieler, der die halbe Saison fehlte,
SOLL einen niedrigeren Erwartungswert haben — das ist genau der Einsatzmengen-
Befund. Die tagesaktuelle Verfügbarkeit regelt separat der Status im Optimierer.
Kai kann exp_points pro Spieler in der JSON hart überschreiben.

Kader-JSON (siehe data/squad.example.json):
  {"reference_season": 2025,
   "players": [{"name":"Batz","club":"Augsburg","position":"TW",
                "id":"pl-...", "exp_points": null}, ...]}
Match-Reihenfolge: erst über "id" (stabil), sonst über Name+Verein.
"""
from __future__ import annotations
import json
import os
import unicodedata

import pandas as pd

from clubs import canon
from matchday_optimizer import SquadPlayer, Pos

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")
MATCHDAYS = 34


def _norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return "".join(c for c in s.lower() if c.isalnum())


def _load_reference(season: int) -> pd.DataFrame:
    df = pd.read_csv(os.path.join(DATA, f"players-se-k0001{season}.csv"), sep=";")
    df["MV"] = pd.to_numeric(df["Marktwert"]) / 1e6
    df["Punkte"] = pd.to_numeric(df["Punkte"])
    df = df[df["MV"] < 100]  # Sentinel MV=999 raus
    df["nkey"] = df["Angezeigter Name (kurz)"].map(_norm_name)
    return df


def load_squad(path: str) -> tuple[list[SquadPlayer], list[str]]:
    """Lädt Kader-JSON, gibt (SquadPlayer-Liste, Warnungen) zurück.
       club_code wird als Attribut an jeden SquadPlayer gehängt (p.club)."""
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    season = cfg.get("reference_season", 2025)
    ref = _load_reference(season)
    by_id = ref.set_index("ID")["Punkte"].to_dict()
    by_name = ref.groupby("nkey")["Punkte"].first().to_dict()

    players, warnings = [], []
    for p in cfg["players"]:
        pts = None
        if p.get("id") and p["id"] in by_id:
            pts = by_id[p["id"]]
        elif _norm_name(p["name"]) in by_name:
            pts = by_name[_norm_name(p["name"])]

        if p.get("exp_points") is not None:
            exp = float(p["exp_points"])            # manuelle Übersteuerung
        elif pts is not None:
            exp = round(pts / MATCHDAYS, 2)
        else:
            exp = 0.0
            warnings.append(f"'{p['name']}' nicht in Saison {season} gefunden "
                            f"→ Erwartungswert 0 (bitte exp_points setzen).")

        club = canon(p.get("club"))
        if club is None:
            warnings.append(f"'{p['name']}': Verein '{p.get('club')}' unbekannt.")

        sp = SquadPlayer(name=p["name"], position=Pos(p["position"]),
                         exp_points=exp, status=p.get("status", "doubt"))
        sp.club = club          # dynamisches Attribut für den Fixture-Join
        players.append(sp)

    # Kader-Struktur prüfen (3 TW, 7 ABW, 7 MF, 5 ST)
    from collections import Counter
    c = Counter(p.position.value for p in players)
    want = {"TW": 3, "ABW": 7, "MF": 7, "ST": 5}
    for pos, n in want.items():
        if c.get(pos, 0) != n:
            warnings.append(f"Kader-Struktur: {c.get(pos,0)}×{pos} (Soll {n}).")
    return players, warnings


if __name__ == "__main__":
    squad, warns = load_squad(os.path.join(DATA, "squad.example.json"))
    print(f"Kader geladen: {len(squad)} Spieler")
    for p in squad:
        print(f"  {p.position.value:<4} {p.name:<16} {getattr(p,'club','?'):<11} "
              f"~{p.exp_points:>4} Pkt/Spieltag  [{p.status}]")
    if warns:
        print("\nWarnungen:")
        for w in warns:
            print("  •", w)
