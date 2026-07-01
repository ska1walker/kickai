"""
Daten-Loader + Effizienz-Scanner
================================
Liest die kicker-Spielerdaten-CSV (Export-URL:
kicker-libero.de/api/sportsdata/v1/players-details/se-XXXX.csv) und
scannt sie nach Effizienz-Ankern — den billigen Dauerspielern, die laut
echter Datenanalyse die Liga entscheiden.

Funktioniert mit jedem kicker-Datensatz: aktuelle Saison (Punkte=0 vor
Start) oder vergangene (mit Punkten). Vor Saisonstart greift die
heuristische Bewertung; während der Saison die echten Punkte.
"""
from __future__ import annotations
import pandas as pd
import numpy as np

POSMAP = {"GOALKEEPER": "TW", "DEFENDER": "ABW",
          "MIDFIELDER": "MF", "FORWARD": "ST"}


def load_kicker_csv(path: str) -> pd.DataFrame:
    """Lädt eine kicker-Spielerdaten-CSV und normalisiert die Spalten."""
    df = pd.read_csv(path, sep=";")
    df["MV"] = pd.to_numeric(df["Marktwert"]) / 1e6
    df["Punkte"] = pd.to_numeric(df["Punkte"])
    df["Note"] = pd.to_numeric(df["Notendurchschnitt"])
    df["Pos"] = df["Position"].map(POSMAP)
    df["nm"] = df["Angezeigter Name (kurz)"]
    df["PptM"] = np.where(df["MV"] > 0, df["Punkte"] / df["MV"], 0)
    return df


def team_strength(df: pd.DataFrame) -> pd.Series:
    """Team-Stärke als Mittelwert der Spielerpunkte (Proxy; vor Saison:
       Vorsaison-Tabellenplatz einsetzen)."""
    return df.groupby("Verein")["Punkte"].transform("mean")


def scan_anchors(df: pd.DataFrame, max_mv: float = 2.0,
                 min_points: int = 120) -> pd.DataFrame:
    """Findet Effizienz-Anker: billig UND viel geliefert.
       (Während/nach der Saison — nutzt echte Punkte.)"""
    anchors = df[(df["MV"] <= max_mv) & (df["Punkte"] >= min_points)]
    return anchors.sort_values("Punkte", ascending=False)


def scan_traps(df: pd.DataFrame, min_mv: float = 3.0,
               max_points: int = 100) -> pd.DataFrame:
    """Findet Marktwert-Fallen: teuer UND wenig geliefert."""
    traps = df[(df["MV"] >= min_mv) & (df["Punkte"] <= max_points)]
    return traps.sort_values("MV", ascending=False)


def preseason_anchor_score(df: pd.DataFrame) -> pd.DataFrame:
    """Heuristische Anker-Bewertung VOR Saisonstart (Punkte noch unbekannt).
       Nutzt nur, was dann verfügbar ist: Marktwert + Team-Stärke + Position.
       Liefert einen Score, KEIN Orakel — Vorfilter für die News-Prüfung.

       Heuristik aus echten 24/25-Daten:
       - Anker sind meist 1.0–2.0 Mio (zu billig = Bankrisiko, zu teuer = keine Effizienz)
       - Teams mit enger, treuer Rotation liefern mehr Anker
       - ABW + MF sind die ergiebigsten Anker-Positionen (defensive Dauerläufer)
    """
    d = df.copy()
    d["TeamStrength"] = team_strength(d)
    ts_norm = (d["TeamStrength"] - d["TeamStrength"].min()) / \
              (d["TeamStrength"].max() - d["TeamStrength"].min() + 1e-9)

    # Marktwert-Sweetspot: Glocke um ~1.5 Mio
    mv_score = np.exp(-((d["MV"] - 1.5) ** 2) / (2 * 0.8 ** 2))
    # Positions-Gewicht (ABW/MF bevorzugt — defensive Dauerläufer)
    pos_w = d["Pos"].map({"TW": 0.7, "ABW": 1.0, "MF": 1.0, "ST": 0.85}).fillna(0.8)
    # Team-Stärke moderat positiv (gutes Team -> bessere Noten/Zu-null)
    d["PreseasonScore"] = (mv_score * pos_w * (0.5 + 0.5 * ts_norm)).round(3)
    return d.sort_values("PreseasonScore", ascending=False)


if __name__ == "__main__":
    import os
    # Pfad zur CSV (relativ zum Projekt)
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv = os.path.join(here, "data", "players-se-k00012025.csv")
    df = load_kicker_csv(csv)

    print("="*64)
    print(f"  DATENSATZ GELADEN: {len(df)} Spieler, {df['Verein'].nunique()} Vereine")
    print("="*64)

    print("\n  TOP-15 EFFIZIENZ-ANKER (≤2,0 Mio, ≥120 Pkt):")
    a = scan_anchors(df).head(15)
    print(f"  {'Spieler':<15}{'Pos':<5}{'Verein':<16}{'MV':>5}{'Pkt':>6}")
    for _, r in a.iterrows():
        print(f"  {r['nm']:<15}{r['Pos']:<5}{r['Verein'][:15]:<16}{r['MV']:>4.1f}{r['Punkte']:>6}")

    print("\n  TOP-8 MARKTWERT-FALLEN (≥3,0 Mio, ≤100 Pkt):")
    t = scan_traps(df).head(8)
    print(f"  {'Spieler':<15}{'Pos':<5}{'Verein':<16}{'MV':>5}{'Pkt':>6}")
    for _, r in t.iterrows():
        print(f"  {r['nm']:<15}{r['Pos']:<5}{r['Verein'][:15]:<16}{r['MV']:>4.1f}{r['Punkte']:>6}")

    print("\n  PRESEASON-HEURISTIK — Top-12 Anker-Kandidaten (≤2,5 Mio):")
    print("  (so würde der Scan VOR Saisonstart aussehen, ohne Punkte)")
    p = preseason_anchor_score(df[df["MV"] <= 2.5]).head(12)
    print(f"  {'Spieler':<15}{'Pos':<5}{'Verein':<16}{'MV':>5}{'Score':>6}{'→ echt':>7}")
    for _, r in p.iterrows():
        print(f"  {r['nm']:<15}{r['Pos']:<5}{r['Verein'][:15]:<16}{r['MV']:>4.1f}"
              f"{r['PreseasonScore']:>6.2f}{r['Punkte']:>7.0f}")
