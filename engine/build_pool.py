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


#: Risiko-Abschlag für geschätzte Spieler, KALIBRIERT an 3 Saisonübergängen:
#: Marktwert-Modell auf Etablierten gefittet, auf echte Neuzugänge angewandt →
#: sie holten 0.84 / 0.72 / 0.81 des prognostizierten Werts (Mittel 0.79).
EST_DISCOUNT = 0.79


def fit_mv_model(df: pd.DataFrame) -> dict[str, tuple[float, float]]:
    """Punkte ≈ a + b·Marktwert, je Position auf den Spielern MIT Historie
    gefittet. Marktwert ist der einzige belastbare Proxy für Spieler ohne
    Vorsaison-Daten (Korr ≈ 0.84, R² ≈ 0.71 im 26/27-Datensatz)."""
    ref = df[df["Punkte"] > 0]
    model: dict[str, tuple[float, float]] = {}
    for pos in ["TW", "ABW", "MF", "ST", "*"]:
        sub = ref if pos == "*" else ref[ref["Position"].map(POSMAP) == pos]
        if len(sub) < 8:
            continue
        x, y = sub["MV"], sub["Punkte"]
        b = ((x - x.mean()) * (y - y.mean())).sum() / ((x - x.mean()) ** 2).sum()
        model[pos] = (float(y.mean() - b * x.mean()), float(b))
    return model


def estimate_points(mv: float, pos: str, model: dict[str, tuple[float, float]]) -> int:
    a, b = model.get(pos) or model.get("*", (0.0, 0.0))
    return max(0, int(round((a + b * mv) * EST_DISCOUNT)))


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
    mv_model: dict[str, tuple[float, float]] = {}
    if args.preseason:
        rdf = load(args.reference)
        ref_points = {r.ID: int(r.Punkte) for r in rdf.itertuples()}
        mv_model = fit_mv_model(target)

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
            # kicker befüllt die Punkte-Spalte der neuen Saison mit den
            # Vorsaison-Punkten vor — auch für Rückkehrer, die in --reference
            # fehlen (z.B. Leih-Rückkehr, Ausland). Deshalb: Referenz zuerst,
            # sonst CSV-Vorbefüllung; Historie = eine der beiden Quellen >0.
            csv_pts = int(r.Punkte)
            has = r.ID in ref_points or csv_pts > 0
            pts = ref_points.get(r.ID, csv_pts)
            bridged += int(has)
            nohist += int(not has)
            entry["points"] = pts
            entry["expPoints"] = round(pts / 34, 2)
            entry["hasHistory"] = bool(has)
            if not has:
                # Ohne Historie: Marktwert-Schätzung, damit teure Neuzugänge
                # nicht als wertlos durchs Raster fallen.
                entry["estPoints"] = estimate_points(float(r.MV), entry["position"], mv_model)
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
              f"{nohist} ohne Historie → Marktwert-Schätzung (×{EST_DISCOUNT}) + Scout/News.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
