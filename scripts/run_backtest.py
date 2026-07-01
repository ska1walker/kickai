"""
Backtest-Runner
===============
Spielt die drei Strategien über VIELE simulierte Saisons (verschiedene Seeds)
und misst, wer gewinnt und wie deutlich. Mehrere Saisons = robuste Aussage
statt Glückstreffer.

Strategien:
  A Stars        - Bauchgefühl, teure Namen
  B PptM-static  - effizienter Kader, aber set-and-forget
  C PptM-active  - effizienter Kader + wöchentliches Mikromanagement
"""
from __future__ import annotations
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "engine"))
import numpy as np
from season import build_universe, simulate_full_season
from strategies import (
    pick_squad_stars, pick_squad_pptm,
    lineup_static, lineup_active, play_season, squad_cost,
)


def run_one_season(universe_seed, season_seed, n_md=34):
    players = build_universe(seed=universe_seed)
    season = simulate_full_season(players, seed=season_seed, n_md=n_md) \
        if False else simulate_full_season(players, seed=season_seed)

    stars = pick_squad_stars(players)
    pptm = pick_squad_pptm(players)

    a_total, a_week = play_season(stars, season, lineup_static, n_md)
    b_total, b_week = play_season(pptm, season, lineup_static, n_md)
    c_total, c_week = play_season(pptm, season, lineup_active, n_md)

    return {
        "A_stars": a_total, "B_pptm_static": b_total, "C_pptm_active": c_total,
        "cost_stars": squad_cost(stars), "cost_pptm": squad_cost(pptm),
        "A_week": a_week, "B_week": b_week, "C_week": c_week,
    }


def main(n_seasons=40, n_md=34):
    rows = []
    for k in range(n_seasons):
        # variiere SOWOHL das Spieler-Universum ALS AUCH den Saisonverlauf
        r = run_one_season(universe_seed=100 + k, season_seed=500 + k, n_md=n_md)
        rows.append(r)

    A = np.array([r["A_stars"] for r in rows])
    B = np.array([r["B_pptm_static"] for r in rows])
    C = np.array([r["C_pptm_active"] for r in rows])
    costA = np.array([r["cost_stars"] for r in rows])
    costP = np.array([r["cost_pptm"] for r in rows])

    print("=" * 66)
    print(f"  kicker Interactive — BACKTEST über {n_seasons} Saisons à {n_md} Spieltage")
    print("=" * 66)
    print(f"\n{'Strategie':<26}{'Ø Saisonpunkte':>16}{'Std':>9}{'Ø Kader-€':>12}")
    print("-" * 66)
    print(f"{'A  Stars (Bauchgefühl)':<26}{A.mean():>16.0f}{A.std():>9.0f}{costA.mean():>11.1f}M")
    print(f"{'B  Punkte/Mio statisch':<26}{B.mean():>16.0f}{B.std():>9.0f}{costP.mean():>11.1f}M")
    print(f"{'C  Punkte/Mio + aktiv':<26}{C.mean():>16.0f}{C.std():>9.0f}{costP.mean():>11.1f}M")

    print(f"\n  Vorsprung B gegenüber A: {B.mean()-A.mean():>+6.0f} Pkt "
          f"({100*(B.mean()-A.mean())/A.mean():+.1f}%)")
    print(f"  Vorsprung C gegenüber A: {C.mean()-A.mean():>+6.0f} Pkt "
          f"({100*(C.mean()-A.mean())/A.mean():+.1f}%)")
    print(f"  Davon allein durchs Mikromanagement (C-B): {C.mean()-B.mean():>+6.0f} Pkt "
          f"({100*(C.mean()-B.mean())/B.mean():+.1f}%)")

    # Wie oft gewinnt C den direkten Vergleich? (das ist die Liga-relevante Frage)
    c_beats_a = np.mean(C > A) * 100
    c_beats_b = np.mean(C > B) * 100
    b_beats_a = np.mean(B > A) * 100
    print(f"\n  In wie viel % der Saisons gewinnt die jeweilige Strategie direkt:")
    print(f"    C schlägt A (Stars):        {c_beats_a:5.0f}% der Saisons")
    print(f"    C schlägt B (nur Kader):    {c_beats_b:5.0f}% der Saisons")
    print(f"    B schlägt A (nur Kader):    {b_beats_a:5.0f}% der Saisons")

    # Spieltagssiege C vs A (Liga-Alltag: wer holt mehr Einzelspieltage?)
    cw = np.concatenate([r["C_week"] for r in rows])
    aw = np.concatenate([r["A_week"] for r in rows])
    print(f"\n  Ø Punkte pro Spieltag:  C {cw.mean():.1f}  vs  A {aw.mean():.1f}")
    print("=" * 66)

    return rows


if __name__ == "__main__":
    main(n_seasons=40)
