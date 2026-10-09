"""Voraussichtliche Elf je Verein von ligainsider.de — Quelle fuer die
Routine "Aufstellung" (scripts/lineup_routine.md).

Liest die Vereinsseite (z. B. /1-fsv-mainz-05/17/), deren prognostizierte
Startelf als `itemprop="athlete"`-Links im HTML steht, und gleicht sie mit
dem eigenen Kader ab. Stehen dort mehr als 11 Namen, enthaelt die Prognose
Alternativen ("Martel (Lee)") — dann gilt die Regel "zwei Namen fuer einen
Platz": mindestens einer ist falsch.

    python3 scripts/ligainsider.py              # alle Vereine mit Kaderspielern
    python3 scripts/ligainsider.py mainz koeln  # nur diese (kanonische Codes)

Keine Noten, keine Paywall-Inhalte — nur die frei sichtbare Aufstellungs-
prognose. Erreichbar nur, wenn www.ligainsider.de im Netzwerk erlaubt ist.
"""
from __future__ import annotations

import html
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))
from news_insert import _fold, _request, _surname  # noqa: E402

BASE = "https://www.ligainsider.de"
# Kanonischer Vereinscode (engine/clubs.py) → Pfad der ligainsider-Vereinsseite.
TEAMS = {
    "koeln": "/1-fc-koeln/15/",
    "union": "/1-fc-union-berlin/1246/",
    "mainz": "/1-fsv-mainz-05/17/",
    "leverkusen": "/bayer-04-leverkusen/4/",
    "dortmund": "/borussia-dortmund/14/",
    "gladbach": "/borussia-moenchengladbach/5/",
    "frankfurt": "/eintracht-frankfurt/3/",
    "augsburg": "/fc-augsburg/21/",
    "bayern": "/fc-bayern-muenchen/1/",
    "schalke": "/fc-schalke-04/13/",
    "hsv": "/hamburger-sv/9/",
    "leipzig": "/rb-leipzig/1311/",
    "freiburg": "/sc-freiburg/18/",
    "paderborn": "/sc-paderborn-07/1249/",
    "elversberg": "/sv-07-elversberg/1331/",
    "bremen": "/sv-werder-bremen/2/",
    "hoffenheim": "/tsg-hoffenheim/10/",
    "stuttgart": "/vfb-stuttgart/12/",
}


def predicted_xi(club: str) -> list[str]:
    req = urllib.request.Request(BASE + TEAMS[club], headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        page = r.read().decode("utf-8", errors="ignore")
    names = re.findall(r'itemprop="athlete"[^>]*>([^<]+)<', page)
    return [html.unescape(n).strip() for n in names]


def main() -> None:
    _, squad, _ = _request("GET", "/squad_players?select=name,club,position")
    clubs = sys.argv[1:] or sorted({p["club"] for p in squad if p["club"] in TEAMS})
    for club in clubs:
        if club not in TEAMS:
            print(f"{club}: kein ligainsider-Pfad bekannt")
            continue
        try:
            xi = predicted_xi(club)
        except Exception as e:  # noqa: BLE001 — ein Verein darf den Rest nicht kippen
            print(f"{club}: FEHLER beim Abruf ({e})")
            continue
        folded = [_fold(n) for n in xi]
        note = (f" — {len(xi)} Namen: enthaelt Alternativen (\"X (Y)\"), "
                "Kaderspieler auf umkaempften Positionen hoechstens doubt") if len(xi) > 11 else ""
        print(f"\n{club}: {', '.join(xi) or '(keine Prognose gefunden)'}{note}")
        for p in [p for p in squad if p["club"] == club]:
            sn = _surname(p["name"])
            # Wortgrenze statt Gleichheit: "S. El Mala" steht dort ebenso
            # wie "Aleix García" — beides muss treffen, "Raum" aber nicht in
            # "Raumdeckung".
            hit = bool(sn) and any(re.search(rf"\b{re.escape(sn)}\b", f) for f in folded)
            print(f"  {p['position']:3} {p['name']}: {'IN der Prognose' if hit else 'nicht in der Prognose'}")


if __name__ == "__main__":
    main()
