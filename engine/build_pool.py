"""
Pool-Generator + Vorsaison-Punkte-Bridge
========================================
Erzeugt die Spieler-Pool-JSON für die Web-App aus der kicker-Export-CSV.

Zwei Modi:
- STANDARD (abgeschlossene Saison): nutzt die echten Saisonpunkte.
- --preseason (Zielsaison noch nicht gespielt → Punkte=0): die erwarteten
  Punkte werden per Spieler-ID aus --reference (Vorsaison) „gebridged".
  Spieler ohne Vorsaison-Historie (Aufsteiger, Neuzugänge, Jugend) bekommen
  points=0 und hasHistory=false → ihre Einschätzung kommt aus Talent-Scout
  (U21/Fritz-Walter/Vorbereitung) und News-Memory.

Hintergrund: Spielernoten werden bewusst NICHT verwendet (Korr(Note,Punkte)≈0
über 4 Saisons). Vorsaisonpunkte sind der beste Proxy für die neue Saison.

Beispiel (wenn 26/27 verfügbar ist):
  python engine/build_pool.py --season 2026 --reference 2025 --preseason
    → web/src/lib/data/players-2026.json
Danach in der App zwei Einzeiler: Import in web/src/lib/data/pool.ts und
DEFAULT_SEASON in web/src/lib/data/squad.ts auf die neue Saison zeigen lassen.
ACHTUNG: neue Auf-/Absteiger ggf. in engine/clubs.py und web/.../clubs.ts ergänzen.
"""
from __future__ import annotations
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pandas as pd  # noqa: E402
from clubs import canon  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")
POSMAP = {"GOALKEEPER": "TW", "DEFENDER": "ABW", "MIDFIELDER": "MF", "FORWARD": "ST"}


def load(season: int) -> pd.DataFrame:
    df = pd.read_csv(os.path.join(DATA, f"players-se-k0001{season}.csv"), sep=";")
    df["MV"] = pd.to_numeric(df["Marktwert"]) / 1e6
    df["Punkte"] = pd.to_numeric(df["Punkte"])
    df = df.rename(columns={"Angezeigter Name (kurz)": "kurz"})
    df = df[df["MV"] < 100]  # Sentinel MV=999 raus
    return df


def main() -> int:
    ap = argparse.ArgumentParser(description="Spieler-Pool erzeugen (mit Vorsaison-Bridge)")
    ap.add_argument("--season", type=int, required=True, help="Startjahr, z.B. 2026 = 26/27")
    ap.add_argument("--reference", type=int, help="Vorsaison-Startjahr für die Punkte-Bridge")
    ap.add_argument("--preseason", action="store_true",
                    help="Zielsaison ungespielt → Punkte aus --reference bridgen")
    ap.add_argument("--out", help="Ausgabepfad (Default web/src/lib/data/players-<season>.json)")
    args = ap.parse_args()

    if args.preseason and not args.reference:
        ap.error("--preseason braucht --reference <Vorsaison>")

    target = load(args.season)
    ref_points: dict[str, int] = {}
    if args.preseason:
        rdf = load(args.reference)
        ref_points = {r.ID: int(r.Punkte) for r in rdf.itertuples()}

    pool = []
    unresolved = bridged = nohist = 0
    for r in target.itertuples():
        code = canon(r.Verein)
        if code is None:
            unresolved += 1
            code = "?"
        entry = {
            "id": r.ID,
            "name": r.kurz,  # "Angezeigter Name (kurz)"
            "club": code,
            "clubName": r.Verein,
            "position": POSMAP.get(r.Position, "?"),
            "mv": round(float(r.MV), 1),
        }
        if args.preseason:
            has = r.ID in ref_points
            pts = ref_points[r.ID] if has else 0
            bridged += int(has)
            nohist += int(not has)
            entry["points"] = pts
            entry["expPoints"] = round(pts / 34, 2)
            entry["hasHistory"] = bool(has)
        else:
            pts = int(r.Punkte)
            entry["points"] = pts
            entry["expPoints"] = round(pts / 34, 2)
        pool.append(entry)

    pool.sort(key=lambda p: -p["points"])
    out = args.out or os.path.join(HERE, "web", "src", "lib", "data", f"players-{args.season}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(pool, f, ensure_ascii=False, indent=0)

    print(f"{len(pool)} Spieler → {os.path.relpath(out, HERE)}")
    if unresolved:
        print(f"  ⚠ {unresolved} unaufgelöste Vereine (in clubs.py ergänzen!)")
    if args.preseason:
        print(f"  Bridge aus Saison {args.reference}: {bridged} mit Vorsaison-Punkten, "
              f"{nohist} ohne Historie (→ Scout/News).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
