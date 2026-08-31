"""
Punkte-Waechter
===============
Pollt die offene kicker-Export-CSV und meldet, sobald die Punktespalte
nach einem Spieltag befuellt wird.

Warum ueberhaupt pollen: kicker gibt die Noten morgens frei, der genaue
Zeitpunkt schwankt. Statt zu raten oder von Hand nachzuschauen, prueft
dieses Skript im Takt und protokolliert jeden Lauf. Nach ein paar
Spieltagen steht damit empirisch fest, wann die Daten wirklich kommen —
und der Takt laesst sich darauf einstellen.

Bewusst nur Standardbibliothek, damit das Skript aus jedem Scheduler
heraus laeuft, ohne dass ein venv aktiv sein muss.

Aufruf:
    python3 engine/watch_scores.py                 # ein Check
    python3 engine/watch_scores.py --squad         # + Auswertung des Kaders
    python3 engine/watch_scores.py --history       # Protokoll der Freigabezeiten

Exit-Codes, damit ein Scheduler ohne eigene Logik entscheiden kann:
    0  = Punkte sind NEU da  -> benachrichtigen
    20 = Punkte da, aber schon gemeldet -> still bleiben
    10 = noch leer -> still bleiben
    1  = Netz-/Abruffehler -> still bleiben (kein Befund)
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "data" / "scores-watch.json"
# ACHTUNG: der Host braucht das www., sonst NXDOMAIN. Die Zahl ist das
# Saison-STARTjahr: se-k00012026 = Saison 2026/27.
CSV_URL = "https://www.kicker-libero.de/api/sportsdata/v1/players-details/se-k0001{season}.csv"
POSMAP = {"GOALKEEPER": "TW", "DEFENDER": "ABW", "MIDFIELDER": "MF", "FORWARD": "ST"}
TIMEOUT = 30


def now() -> datetime:
    return datetime.now(timezone.utc).astimezone()


def fetch_csv(season: int) -> list[dict]:
    url = CSV_URL.format(season=season)
    req = urllib.request.Request(url, headers={"User-Agent": "kick-ai/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        raw = r.read().decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(raw), delimiter=";"))


def scored(rows: list[dict]) -> list[dict]:
    """Spieler mit Punkten != 0. Vor dem ersten Spieltag ist das leer."""
    out = []
    for r in rows:
        try:
            if int(r["Punkte"]) != 0:
                out.append(r)
        except (ValueError, KeyError):
            continue
    return out


def load_state(season: int) -> tuple[dict, dict]:
    """Gibt (Gesamtzustand, Zustand dieser Saison) zurueck.

    Pro Saison getrennt, weil ein Lauf gegen eine alte Saison sonst den
    Zaehler der laufenden ueberschreibt — dann bliebe die erste echte
    Freigabe unprotokolliert.
    """
    all_state = json.loads(STATE.read_text()) if STATE.exists() else {}
    season_state = all_state.setdefault(str(season), {"polls": [], "arrivals": [], "last_scored": 0})
    return all_state, season_state


def save_state(all_state: dict, season_state: dict) -> None:
    # Das Poll-Protokoll waechst sonst unbegrenzt; die letzten 500 reichen,
    # um den Freigabe-Rhythmus abzulesen.
    season_state["polls"] = season_state["polls"][-500:]
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(all_state, indent=2, ensure_ascii=False) + "\n")


def read_env(path: Path) -> dict:
    """Liest KEY=VALUE aus einer .env-Datei, ohne sie zu importieren."""
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def load_squad() -> list[dict]:
    """Holt den Kader aus Supabase. Leere Liste, wenn nicht konfiguriert."""
    env = read_env(ROOT / "web" / ".env.local")
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or env.get(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
    if not url or not key:
        return []
    req = urllib.request.Request(
        f"{url}/rest/v1/squad_players?select=id,name,position,mv",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode())
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        print(f"  (Kader nicht ladbar: {e})", file=sys.stderr)
        return []


def report_squad(rows: list[dict], squad: list[dict]) -> None:
    by_id = {r["ID"]: r for r in rows}
    lines, total = [], 0
    order = {"TW": 0, "ABW": 1, "MF": 2, "ST": 3}
    for p in sorted(squad, key=lambda x: (order.get(x["position"], 9), -float(x["mv"] or 0))):
        r = by_id.get(p["id"])
        if not r:
            lines.append(f"  {p['position']:<4}{p['name']:<18}  nicht mehr in der CSV")
            continue
        pts = int(r["Punkte"])
        note = r["Notendurchschnitt"]
        total += pts
        lines.append(f"  {p['position']:<4}{p['name']:<18}{pts:>4} Pkt   Note {note}")
    print("\n".join(lines))
    print(f"\n  Kader gesamt: {total} Punkte")
    print("  (Summe ueber alle 22 — im Managerspiel zaehlt nur die aufgestellte Elf.)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--season", type=int, default=2026, help="Startjahr, 2026 = 26/27")
    ap.add_argument("--squad", action="store_true", help="Kaderpunkte mit ausgeben")
    ap.add_argument("--history", action="store_true", help="Freigabezeiten anzeigen")
    args = ap.parse_args()

    all_state, state = load_state(args.season)

    if args.history:
        if not state["arrivals"]:
            print(f"Saison {args.season}: noch keine Freigabe protokolliert.")
            return 0
        print(f"Saison {args.season} — bisher beobachtete Freigaben der Punktespalte:")
        for a in state["arrivals"]:
            print(f"  {a['at']}  {a['scored']} Spieler mit Punkten")
        return 0

    stamp = now()
    try:
        rows = fetch_csv(args.season)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        # Nicht als "noch nichts da" werten — ein Netzfehler ist kein Befund.
        print(f"FEHLER: CSV nicht erreichbar ({e})", file=sys.stderr)
        return 1

    hits = scored(rows)
    state["polls"].append(
        {"at": stamp.isoformat(timespec="seconds"), "rows": len(rows), "scored": len(hits)}
    )

    if not hits:
        state["last_scored"] = 0
        save_state(all_state, state)
        print(f"WARTEN — {stamp:%d.%m. %H:%M}: Punktespalte noch leer ({len(rows)} Spieler).")
        return 10

    # Erste Freigabe nach einer leeren Phase = neuer Spieltag. Nur dann
    # protokollieren und melden — sonst schlaegt jeder weitere Poll des
    # Tages erneut Alarm.
    first = state.get("last_scored", 0) == 0
    if first:
        state["arrivals"].append(
            {"at": stamp.isoformat(timespec="seconds"), "scored": len(hits)}
        )
    state["last_scored"] = len(hits)
    save_state(all_state, state)

    if not first:
        print(f"BEKANNT — {stamp:%d.%m. %H:%M}: Punkte da, bereits gemeldet.")
        return 20

    print(f"TREFFER — {stamp:%d.%m. %H:%M}: Punkte sind da.")
    print(f"  {len(hits)} von {len(rows)} Spielern haben Punkte.")
    if args.squad:
        squad = load_squad()
        if squad:
            print()
            report_squad(rows, squad)
    return 0


if __name__ == "__main__":
    sys.exit(main())
