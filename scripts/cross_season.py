"""
Cross-Season-Analyse (4 Saisons: 21/22 → 24/25)
================================================
Zwei Fragen, die mit nur EINER Saison nicht sauber beantwortbar waren:

  A) MUSTER-STABILITÄT: Halten die Befunde aus CLAUDE.md über die Jahre?
     - Korr(Marktwert, Punkte) und Korr(Note, Punkte) je Saison
     - Anzahl Effizienz-Anker (<=2M, >=120 Pkt) + welche Teams sie liefern
     - Ist der Note-Punkte-Zusammenhang stabil ~0 (=> Einsatzmenge zaehlt)?

  B) VORHERSAGE (ehrlich, out-of-sample): Was in Saison N sagt die Punkte in
     N+1 voraus? Trainiert auf 21->22 und 22->23, blind getestet auf 23->24.
     Kernfrage: Schlaegt der Vorsaison-OUTPUT (Punkte_N, Proxy fuer
     "war gesetzt") den reinen Marktwert_N? Genau das kann eine statische
     Preseason-Tabelle nicht — und ist der Hebel des Projekts.

Datenbasis pro Spieler und Saison: nur MV, Verein, Position, Punkte, Note.
Spieler werden ueber die stabile ID (pl-k...) ueber Saisons gematcht.
"""
from __future__ import annotations
import os
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")
POSMAP = {"GOALKEEPER": "TW", "DEFENDER": "ABW", "MIDFIELDER": "MF", "FORWARD": "ST"}
# se-k0001<Jahr> = Saison Jahr/Jahr+1 (verifiziert über Auf-/Absteiger).
SEASONS = {2022: "22/23", 2023: "23/24", 2024: "24/25", 2025: "25/26"}


def load(year: int) -> pd.DataFrame:
    df = pd.read_csv(os.path.join(DATA, f"players-se-k0001{year}.csv"), sep=";")
    df["MV"] = pd.to_numeric(df["Marktwert"]) / 1e6
    df["Punkte"] = pd.to_numeric(df["Punkte"])
    df["Note"] = pd.to_numeric(df["Notendurchschnitt"])
    df["Pos"] = df["Position"].map(POSMAP)
    df["nm"] = df["Angezeigter Name (kurz)"]
    # Sentinel: MV=999 Mio bedeutet "kein Marktwert gelistet" (v.a. 23/24) — raus.
    df = df[df["MV"] < 100]
    return df[["ID", "nm", "Verein", "Pos", "MV", "Punkte", "Note"]]


def team_strength(df: pd.DataFrame) -> pd.Series:
    """Proxy: mittlere Spielerpunkte des Vereins in dieser Saison."""
    return df.groupby("Verein")["Punkte"].transform("mean")


# ------------------------------------------------------------------ Teil A
def part_a():
    print("=" * 68)
    print("  TEIL A — MUSTER-STABILITAET UEBER 4 SAISONS")
    print("=" * 68)
    print(f"  {'Saison':<8}{'n':>5}{'Korr MV~Pkt':>13}{'Korr Note~Pkt':>15}"
          f"{'#Anker':>8}")
    frames = {}
    for y, lbl in SEASONS.items():
        df = load(y)
        frames[y] = df
        played = df[df["Punkte"] > 0]  # Note nur bei Eingesetzten sinnvoll
        c_mv = df["MV"].corr(df["Punkte"])
        c_note = played["Note"].corr(played["Punkte"])
        anchors = df[(df["MV"] <= 2.0) & (df["Punkte"] >= 120)]
        print(f"  {lbl:<8}{len(df):>5}{c_mv:>13.2f}{c_note:>15.2f}{len(anchors):>8}")

    print("\n  Anker-liefernde Teams (<=2M & >=120 Pkt), Top-5 je Saison:")
    for y, lbl in SEASONS.items():
        df = frames[y]
        a = df[(df["MV"] <= 2.0) & (df["Punkte"] >= 120)]
        top = a["Verein"].value_counts().head(5)
        s = ", ".join(f"{v.split()[0][:10]}({n})" for v, n in top.items())
        print(f"    {lbl}: {s}")

    print("\n  Anker nach Position (Summe ueber alle 4 Saisons):")
    allpos = pd.concat(
        [frames[y][(frames[y]['MV'] <= 2.0) & (frames[y]['Punkte'] >= 120)]
         for y in SEASONS])
    print("    " + "  ".join(f"{p}:{n}" for p, n in
                             allpos["Pos"].value_counts().items()))
    return frames


# ------------------------------------------------------------------ Teil B
def build_pairs(a: pd.DataFrame, b: pd.DataFrame) -> pd.DataFrame:
    """Spieler, die in Saison a UND b vorkommen. Features aus a, Ziel aus b."""
    a = a.copy()
    a["TeamStr"] = team_strength(a)
    m = a.merge(b[["ID", "Punkte"]], on="ID", suffixes=("_N", "_N1"))
    return m


def evaluate(name, y_true, y_pred):
    r2 = r2_score(y_true, y_pred)
    corr = np.corrcoef(y_true, y_pred)[0, 1]
    mae = np.mean(np.abs(y_true - y_pred))
    print(f"    {name:<34} R2={r2:>6.3f}  Korr={corr:>5.2f}  MAE={mae:>5.0f}")
    return r2


def part_b(frames):
    print("\n" + "=" * 68)
    print("  TEIL B — VORHERSAGE N -> N+1 (ehrlich, out-of-sample)")
    print("=" * 68)

    train = pd.concat([build_pairs(frames[2022], frames[2023]),
                       build_pairs(frames[2023], frames[2024])],
                      ignore_index=True)
    test = build_pairs(frames[2024], frames[2025])
    print(f"  Train: 22/23->23/24 + 23/24->24/25  (n={len(train)})")
    print(f"  Test : 24/25->25/26  BLIND          (n={len(test)})\n")

    yb_tr, yb_te = train["Punkte_N1"], test["Punkte_N1"]

    print("  Einzel-Praediktoren (nur diese eine Groesse, auf Test):")
    # 1) reiner Marktwert
    lr = LinearRegression().fit(train[["MV"]], yb_tr)
    evaluate("Marktwert_N allein", yb_te, lr.predict(test[["MV"]]))
    # 2) reiner Vorsaison-Output (Proxy fuer "war gesetzt")
    lr = LinearRegression().fit(train[["Punkte_N"]], yb_tr)
    r2_pts = evaluate("Punkte_N allein (Einsatz-Proxy)", yb_te,
                      lr.predict(test[["Punkte_N"]]))
    # 3) reine Note
    lr = LinearRegression().fit(train[["Note"]], yb_tr)
    evaluate("Note_N allein", yb_te, lr.predict(test[["Note"]]))

    print("\n  Kombiniertes Modell (auf Test):")
    feats = ["MV", "Punkte_N", "Note", "TeamStr"]
    Xtr = pd.get_dummies(train[feats + ["Pos"]], columns=["Pos"]).astype(float)
    Xte = pd.get_dummies(test[feats + ["Pos"]], columns=["Pos"]).astype(float)
    Xte = Xte.reindex(columns=Xtr.columns, fill_value=0.0)
    lr = LinearRegression().fit(Xtr, yb_tr)
    r2_full = evaluate("MV+Punkte+Note+Team+Pos", yb_te, lr.predict(Xte))

    print(f"\n  => Vorsaison-Output schlaegt Marktwert: R2 {r2_pts:.2f} vs. "
          f"MV, Kombi {r2_full:.2f}")

    # ---- Praktischer Payoff: BILLIGE Spieler in N -> Anker in N+1? ----
    print("\n  PAYOFF — Treffer unter GUENSTIGEN (<=2.5M in N):")
    print("  Wenn ich in N die billigen Spieler nach X ranke, wie viele der")
    print("  echten Anker (>=120 Pkt in N+1) sind in meinen Top-30?")
    cheap = test[test["MV"] <= 2.5].copy()
    real_anchors = set(cheap[cheap["Punkte_N1"] >= 120]["ID"])
    n_real = len(real_anchors)
    for label, col, asc in [("Marktwert (teuerste zuerst)", "MV", False),
                            ("Vorsaison-Punkte", "Punkte_N", False),
                            ("Team-Staerke", "TeamStr", False)]:
        top30 = cheap.sort_values(col, ascending=asc).head(30)
        hit = len(set(top30["ID"]) & real_anchors)
        print(f"    Rang nach {label:<28} Treffer {hit:>2}/{n_real}")
    print(f"    (billige Spieler gesamt: {len(cheap)}, davon echte Anker: {n_real})")


if __name__ == "__main__":
    frames = part_a()
    part_b(frames)
