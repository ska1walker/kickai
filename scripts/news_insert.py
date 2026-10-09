"""Schreibt gesammelte Bundesliga-News nach Supabase `news_log`.

Gegenstueck zur Vercel-Route `web/src/app/api/collect-news/route.ts`, fuer den
News-Sammler als Claude-Code-Routine (seit 09.10.2026 der Hauptweg). Die
Routine recherchiert selbst und uebergibt hier nur eine JSON-Datei; dieses
Skript haelt dieselben Regeln wie die Route ein, damit das Archiv gleich
aussieht, egal wer schreibt:

- Vereinsname → kanonischer Code (engine/clubs.py)
- dedup_key = typ:verein:slug(spieler|summary) → dieselbe Story ueber Tage
  wird aktualisiert statt doppelt angelegt (Upsert)
- durable-Default nach Typ, Impact-Leitplanken (other ohne Spieler ≤ 2;
  Verletzung/Transfer/Sperre MIT Spieler ≥ 3)

Zugang: die Supabase-REST-API. Den anon-Key haengt der Proxy der Cloud-
Umgebung an (Secret "Supabase kickai"); ausserhalb davon wird er aus
NEXT_PUBLIC_SUPABASE_ANON_KEY gelesen, falls gesetzt.

    python3 scripts/news_insert.py --squad          # Kader ausgeben (Fokusliste)
    python3 scripts/news_insert.py --check          # Eintraege der letzten 8 Tage
    python3 scripts/news_insert.py items.json       # schreiben
    python3 scripts/news_insert.py items.json --dry-run

items.json: Liste von Objekten mit type, summary, impact, optional club,
player, durable, source — exakt das Schema von report_news in der Route.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))
from clubs import canon  # noqa: E402

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://llagnybrzybbkeidqtzc.supabase.co")
REST = URL.rstrip("/") + "/rest/v1"

TYPES = {"transfer_in", "transfer_out", "coach", "injury", "suspension",
         "return", "preseason_form", "starter", "other"}
DURABLE_TYPES = {"transfer_in", "transfer_out", "coach", "suspension"}


def _headers(extra: dict | None = None) -> dict:
    h = {"Content-Type": "application/json"}
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if key:  # sonst setzt der Proxy die Header selbst
        h["apikey"] = key
        h["Authorization"] = f"Bearer {key}"
    h.update(extra or {})
    return h


def _request(method: str, path: str, body=None, extra: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(REST + path, data=data, method=method,
                                 headers=_headers(extra))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None), r.headers
    except urllib.error.HTTPError as e:
        sys.exit(f"Supabase {method} {path}: HTTP {e.code} {e.read().decode()[:500]}")


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:60]


def to_row(item: dict, today: str) -> dict | None:
    typ = item.get("type")
    summary = (item.get("summary") or "").strip()
    if typ not in TYPES or not summary:
        return None
    summary = re.sub(r"</?cite[^>]*>", "", summary).strip()
    player = (item.get("player") or "").strip()
    # Platzhalter ("-", "n/a", …) sind kein Spieler.
    if len(re.sub(r"[^\w]", "", player)) < 3:
        player = ""
    club = canon(item["club"]) if item.get("club") else None
    durable = item.get("durable")
    if durable is None:
        durable = typ in DURABLE_TYPES
    impact = min(4, max(1, round(float(item.get("impact") or 2))))
    if typ == "other" and not player:
        impact = min(impact, 2)
    if player and typ in {"injury", "transfer_in", "transfer_out", "suspension"}:
        impact = max(impact, 3)
    return {
        "news_date": today,
        "club": club,
        "player": player or None,
        "type": typ,
        "durable": bool(durable),
        "impact": impact,
        "summary": summary,
        "source": item.get("source") or None,
        "dedup_key": f"{typ}:{club or 'x'}:{slug(player or summary)}",
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("file", nargs="?", help="JSON-Datei mit den Meldungen")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--squad", action="store_true", help="Kader ausgeben")
    ap.add_argument("--check", action="store_true", help="Eintraege der letzten 8 Tage")
    a = ap.parse_args()

    if a.squad:
        _, rows, _ = _request("GET", "/squad_players?select=name,club,position&order=position")
        for r in rows:
            print(f"{r['position']:3} {r['name']} ({r['club']})")
        return
    if a.check:
        since = (dt.date.today() - dt.timedelta(days=8)).isoformat()
        _, rows, _ = _request("GET", f"/news_log?select=id&news_date=gte.{since}",
                              extra={"Prefer": "count=exact"})
        print(f"{len(rows)} Eintraege seit {since}")
        return
    if not a.file:
        ap.error("JSON-Datei fehlt")

    items = json.loads(Path(a.file).read_text())
    if isinstance(items, dict):
        items = items.get("items", [])
    today = dt.date.today().isoformat()
    rows, dropped = [], 0
    seen: set[str] = set()
    for it in items:
        r = to_row(it, today)
        # Doppelte Schluessel in EINEM Upsert lehnt Postgres ab → ersten behalten.
        if r is None or r["dedup_key"] in seen:
            dropped += 1
            continue
        seen.add(r["dedup_key"])
        rows.append(r)
    print(f"{len(rows)} gueltig, {dropped} verworfen")
    if a.dry_run or not rows:
        print(json.dumps(rows, ensure_ascii=False, indent=1))
        return
    _request("POST", "/news_log?on_conflict=dedup_key", rows,
             extra={"Prefer": "resolution=merge-duplicates,return=minimal"})
    print(f"inserted {len(rows)}")


if __name__ == "__main__":
    main()
