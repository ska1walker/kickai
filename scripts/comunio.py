"""Voraussichtliche Aufstellungen aus dem Comunio-Magazin — Gegencheck zu
ligainsider fuer die Routine "Aufstellung" (scripts/lineup_routine.md).

Das Magazin schreibt je Spiel einen Vorschau-Artikel
("<heim>-<gast>-voraussichtliche-aufstellungen[-N]") mit einem festen Block
je Verein:

    Voraussichtliche Aufstellung TSG Hoffenheim
    Aufstellung: Baumann – Coufal, Kabak, Machida (Hranac), Rots – …
    Diese Spieler fehlen: …
    Diese Spieler sind angeschlagen: …
    Moegliche Optionen: …

Das Skript sammelt die Artikel der letzten Tage, zerlegt die Bloecke und
ordnet jeden Kaderspieler ein: Startelf / Alternative in Klammern (= doubt) /
fehlt / angeschlagen / als Option genannt / nicht genannt.

    python3 scripts/comunio.py          # alle Vereine mit Kaderspielern
    python3 scripts/comunio.py --days 4 # nur Artikel der letzten 4 Tage

Erreichbar nur, wenn magazin.comunio.de im Netzwerk erlaubt ist.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))
from clubs import canon  # noqa: E402
from news_insert import _fold, _request, _surname  # noqa: E402

BASE = "https://magazin.comunio.de"
LISTINGS = [BASE + "/?s=voraussichtliche+aufstellungen", BASE + "/"]
SECTIONS = ["Aufstellung:", "Diese Spieler fehlen:", "Diese Spieler sind angeschlagen:",
            "Mögliche Optionen:"]


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="ignore")


def _text(page: str) -> str:
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))


def article_urls() -> list[str]:
    urls: list[str] = []
    for listing in LISTINGS:
        try:
            page = _get(listing)
        except Exception:  # noqa: BLE001 — eine Liste reicht
            continue
        for u in re.findall(rf'href="({re.escape(BASE)}/[^"]*voraussichtliche-aufstellungen[^"]*)"', page):
            if u not in urls:
                urls.append(u)
    return urls


def parse_blocks(text: str) -> dict[str, dict[str, str]]:
    """Verein (kanonischer Code) → {Abschnitt: Text}."""
    out: dict[str, dict[str, str]] = {}
    parts = re.split(r"Voraussichtliche Aufstellung (?!en)", text)
    for part in parts[1:]:
        i = part.find("Aufstellung:")
        if i < 0:
            continue
        club = canon(part[:i].strip())
        if not club:
            continue
        body = part[i:]
        # Block endet beim naechsten Verein oder beim Werbe-/Navigationsteil.
        body = re.split(r"Jetzt Comunio spielen|Voraussichtliche Aufstellungen –", body)[0]
        sec: dict[str, str] = {}
        for j, name in enumerate(SECTIONS):
            a = body.find(name)
            if a < 0:
                continue
            ends = [body.find(n, a + len(name)) for n in SECTIONS[j + 1:]]
            ends = [e for e in ends if e > 0]
            sec[name] = body[a + len(name): min(ends) if ends else len(body)].strip()
        out[club] = sec
    return out


def classify(name: str, sec: dict[str, str]) -> str:
    sn = _surname(name)
    if not sn:
        return "nicht genannt"
    pat = re.compile(rf"\b{re.escape(sn)}\b")
    xi = _fold(sec.get("Aufstellung:", ""))
    in_parens = " ".join(re.findall(r"\(([^)]*)\)", xi))
    outside = re.sub(r"\([^)]*\)", " ", xi)
    if pat.search(outside):
        slot = next((s for s in re.split(r"[,–-]", xi) if pat.search(s)), "")
        return "Startelf, Platz umkaempft" if "(" in slot else "Startelf"
    if pat.search(in_parens):
        return "Alternative in Klammern (doubt)"
    if pat.search(_fold(sec.get("Diese Spieler fehlen:", ""))):
        return "FEHLT"
    if pat.search(_fold(sec.get("Diese Spieler sind angeschlagen:", ""))):
        return "angeschlagen"
    if pat.search(_fold(sec.get("Mögliche Optionen:", ""))):
        return "als Option genannt"
    return "nicht genannt"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--days", type=int, default=6, help="nur Artikel der letzten N Tage")
    a = ap.parse_args()

    _, squad, _ = _request("GET", "/squad_players?select=name,club,position")
    wanted = {p["club"] for p in squad}
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=a.days)
    found: dict[str, tuple[str, str, dict[str, str]]] = {}  # club → (url, datum, block)
    for url in article_urls():
        try:
            page = _get(url)
        except Exception as e:  # noqa: BLE001
            print(f"FEHLER beim Abruf {url}: {e}")
            continue
        m = re.search(r'"datePublished":"([^"]+)"', page)
        if not m:
            continue
        published = dt.datetime.fromisoformat(m.group(1))
        if published < since:
            continue
        for club, sec in parse_blocks(_text(page)).items():
            if club in wanted and (club not in found or found[club][1] < m.group(1)):
                found[club] = (url, m.group(1), sec)

    for club in sorted(wanted):
        if club not in found:
            print(f"\n{club}: kein Comunio-Artikel der letzten {a.days} Tage gefunden")
            continue
        url, date, sec = found[club]
        print(f"\n{club} ({date[:10]}, {url})")
        print(f"  Aufstellung: {sec.get('Aufstellung:', '?')}")
        for key in SECTIONS[1:]:
            if sec.get(key) and sec[key] not in ("–", "-"):
                print(f"  {key} {sec[key][:300]}")
        for p in [p for p in squad if p["club"] == club]:
            print(f"  → {p['position']:3} {p['name']}: {classify(p['name'], sec)}")


if __name__ == "__main__":
    main()
