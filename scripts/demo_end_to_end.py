"""
End-to-End-Demo: echter Datensatz -> Optimierer
===============================================
Zeigt den kompletten Fluss mit echten 2024/25-Daten:
  1. CSV laden
  2. einen effizienten Beispiel-Kader bauen (Top-Anker + 2 Stars)
  3. Spieltags-Status simulieren
  4. optimale Startelf empfehlen

In Produktion ersetzt du Schritt 3 durch echte Fr/Sa-Aufstellungsnews.

Aufruf:  python scripts/demo_end_to_end.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

from data_loader import load_kicker_csv, scan_anchors
from matchday_optimizer import SquadPlayer, Pos, optimize_matchday, print_result

HERE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(HERE, "..", "data", "players-se-k00012025.csv")

POS_ENUM = {"TW": Pos.TW, "ABW": Pos.ABW, "MF": Pos.MF, "ST": Pos.ST}


def build_example_squad(df):
    """Baut einen effizienz-orientierten 22er-Kader aus echten Daten:
       beste Anker je Position + Restbudget in 2 Stars. Rein zur Demo."""
    REQ = {"TW": 3, "ABW": 7, "MF": 7, "ST": 5}
    df = df.copy()
    df["score"] = df["Punkte"] / df["MV"].clip(lower=0.1)  # echte Effizienz
    picks = []
    for pos, need in REQ.items():
        pool = df[df["Pos"] == pos].sort_values("Punkte", ascending=False)
        picks += pool.head(need).to_dict("records")
    return picks


def main():
    df = load_kicker_csv(CSV)
    squad_rows = build_example_squad(df)

    # In SquadPlayer umwandeln; erwarteter Punktwert = Saisonpunkte / 34
    squad = []
    for r in squad_rows:
        squad.append(SquadPlayer(
            name=r["nm"], position=POS_ENUM[r["Pos"]],
            exp_points=round(r["Punkte"] / 34, 2), status="start"))

    # Spieltags-Status simulieren: ein paar fallen aus / sind fraglich
    # (in echt: aus den Aufstellungsnews)
    import random; random.seed(7)
    for p in squad:
        roll = random.random()
        if roll < 0.12:
            p.status = "out"
        elif roll < 0.25:
            p.status = "doubt"
        elif roll < 0.45:
            p.status = "bench"
        # sonst bleibt "start"

    print("=" * 56)
    print("  END-TO-END DEMO — echter 24/25-Datensatz")
    print("=" * 56)
    print(f"  Kader: {len(squad)} Spieler aus {df['Verein'].nunique()} Vereinen")
    n_out = sum(1 for p in squad if p.status == "out")
    n_doubt = sum(1 for p in squad if p.status == "doubt")
    print(f"  Diesen Spieltag: {n_out} Ausfälle, {n_doubt} fraglich")

    res = optimize_matchday(squad)
    print_result(res)

    print("\n  → In Produktion: Status aus Fr/Sa-News, dann diese Elf im")
    print("    echten kicker setzen (manuell, 2 Klicks).")


if __name__ == "__main__":
    main()
