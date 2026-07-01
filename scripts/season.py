"""
Saison-Simulator für den kicker-Backtest
=========================================
Erzeugt ein realistisches Spieler-Universum (eine Bundesliga-Saison) und
simuliert 34 Spieltage. Entscheidend für die Aussagekraft:

  * Jeder Spieler hat eine LATENTE QUALITÄT (skill) -> bestimmt die erwartete Note.
  * Jeder Spieler hat einen MARKTWERT, der nur TEILWEISE mit skill korreliert
    (Prominenz, Name, Hype verzerren ihn -> rho ~ 0.6). Genau diese Lücke ist
    der Grund, warum "Punkte pro Million" gewinnt.
  * Jeder Spieler hat eine EINSATZWAHRSCHEINLICHKEIT (start_prob) -> Rotation,
    Verletzungsanfälligkeit. Stars rotieren/verletzen sich teils häufiger.
  * Noten schwanken pro Spieltag (Varianz). Ab und zu Ausreißer.

Die Simulation ist deterministisch über einen Seed -> reproduzierbar.
"""
from __future__ import annotations
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "engine"))
import numpy as np
from dataclasses import dataclass, field
from scoring import Position, PlayerMatchPerformance, score_performance, note_to_points

# Kader-Restriktionen (BL): 3 TW, 6 ABW, 8 MF, 5 ST = 22, Budget 42,5 Mio
SQUAD_REQ = {Position.TW: 3, Position.ABW: 6, Position.MF: 8, Position.ST: 5}
BUDGET = 42.5  # Mio. €

# Wie viele Spieler pro Position das Liga-Universum hat (18 Vereine, grob)
UNIVERSE = {Position.TW: 36, Position.ABW: 110, Position.MF: 120, Position.ST: 60}


@dataclass
class Player:
    pid: int
    name: str
    position: Position
    club: int
    skill: float          # latente Qualität 0..1 (hoch = bessere Ø-Note)
    market_value: float    # Mio €
    start_prob: float      # Wahrscheinlichkeit, an einem Spieltag zu starten
    goal_rate: float       # erwartete Tore pro Start
    assist_rate: float
    # abgeleitet:
    exp_note_mean: float = 0.0  # erwartete Durchschnittsnote


def build_universe(seed: int = 42) -> list[Player]:
    rng = np.random.default_rng(seed)
    players: list[Player] = []
    pid = 0
    for pos, n in UNIVERSE.items():
        for i in range(n):
            club = rng.integers(0, 18)
            # latente Qualität: leicht rechtsschief, die meisten mittelmäßig
            skill = float(np.clip(rng.beta(2.2, 2.2), 0.02, 0.98))

            # erwartete Ø-Note: skill 1.0 -> ~2.2 ; skill 0.0 -> ~4.0
            exp_note = 4.0 - skill * 1.9   # 2.1 .. 4.0

            # Marktwert: korreliert mit skill, ABER mit kräftigem Rauschen
            # (Prominenz/Hype). rho ~ 0.6. Stürmer + Offensive sind teurer
            # bei gleicher Qualität (Marktwert-Falle!).
            pos_premium = {Position.TW: 0.85, Position.ABW: 0.9,
                           Position.MF: 1.05, Position.ST: 1.45}[pos]
            noise = rng.normal(0, 0.32)
            base = (skill + noise) * pos_premium
            mv = float(np.clip(np.exp(base * 2.6) * 0.25, 0.15, 22.0))

            # Einsatzwahrscheinlichkeit: gute Spieler spielen öfter,
            # aber Top-Stars rotieren/verletzen sich auch mal (leichte Delle oben).
            base_start = 0.45 + skill * 0.5
            # Verletzungs-/Rotationsrauschen
            sp = float(np.clip(base_start - rng.uniform(0, 0.18), 0.25, 0.97))

            # Tor-/Assist-Raten je Position
            grate = {Position.TW: 0.0, Position.ABW: 0.06,
                     Position.MF: 0.14, Position.ST: 0.42}[pos] * (0.4 + skill)
            arate = {Position.TW: 0.0, Position.ABW: 0.05,
                     Position.MF: 0.16, Position.ST: 0.18}[pos] * (0.4 + skill)

            players.append(Player(
                pid=pid, name=f"{pos.value}{i:03d}", position=pos, club=int(club),
                skill=skill, market_value=round(mv, 2), start_prob=round(sp, 3),
                goal_rate=float(grate), assist_rate=float(arate),
                exp_note_mean=round(exp_note, 3),
            ))
            pid += 1
    return players


def simulate_matchday(player: Player, rng: np.random.Generator) -> PlayerMatchPerformance:
    """Simuliert die reale Leistung EINES Spielers an EINEM Spieltag."""
    perf = PlayerMatchPerformance(name=player.name, position=player.position)

    # Spielt er? (Start / eingewechselt / gar nicht)
    r = rng.random()
    if r < player.start_prob:
        perf.started = True
        perf.minutes = int(rng.integers(60, 95))
    elif r < player.start_prob + 0.12:
        perf.came_on = True
        perf.minutes = int(rng.integers(8, 35))
    else:
        return perf  # nicht im Einsatz -> keine Punkte wenn aufgestellt

    # Note nur, wenn >=25 Min (vereinfachte Regel)
    if perf.minutes >= 25:
        # Note streut um den Erwartungswert; Standardabweichung ~0.7
        raw = rng.normal(player.exp_note_mean, 0.7)
        # auf 0.5er-Schritte runden, in [1.0, 6.0]
        note = float(np.clip(round(raw * 2) / 2, 1.0, 6.0))
        perf.note = note

    # Tore / Assists (nur wenn gestartet, grob)
    if perf.started:
        perf.goals = int(rng.poisson(player.goal_rate))
        perf.assists = int(rng.poisson(player.assist_rate))
        # Zu null für TW: höher bei gutem skill
        if player.position == Position.TW:
            perf.clean_sheet = rng.random() < (0.18 + player.skill * 0.22)
        # Spieler des Spiels: korreliert mit sehr guter Note
        if perf.note is not None and perf.note <= 2.0:
            perf.motm = rng.random() < 0.18
        # Karten (selten)
        cr = rng.random()
        if cr < 0.012:
            perf.red = True
        elif cr < 0.03:
            perf.yellow_red = True

    return perf


def simulate_full_season(players: list[Player], seed: int = 7, n_matchdays: int = 34):
    """
    Erzeugt für jeden Spieler an jedem Spieltag eine reale Performance.
    Returns: dict[matchday] -> dict[pid] -> PlayerMatchPerformance
    """
    rng = np.random.default_rng(seed)
    season = {}
    for md in range(1, n_matchdays + 1):
        day = {}
        for pl in players:
            day[pl.pid] = simulate_matchday(pl, rng)
        season[md] = day
    return season


def actual_season_points_if_started(pid: int, season: dict, n_matchdays: int = 34) -> int:
    """Wie viele Punkte hätte Spieler X gebracht, wenn IMMER aufgestellt?
       (= seine reine Qualität, ohne Manager-Entscheidungen). Für Analyse."""
    total = 0
    for md in range(1, n_matchdays + 1):
        total += score_performance(season[md][pid], "start")
    return total


if __name__ == "__main__":
    players = build_universe(seed=42)
    print(f"Universum: {len(players)} Spieler")
    for pos, n in UNIVERSE.items():
        sub = [p for p in players if p.position == pos]
        mvs = [p.market_value for p in sub]
        print(f"  {pos.value}: {n} Spieler | MV {min(mvs):.1f}–{max(mvs):.1f} Mio (Ø {np.mean(mvs):.1f})")

    # Korrelation skill <-> marktwert prüfen (soll ~0.6 sein, nicht 1.0)
    sk = np.array([p.skill for p in players])
    mv = np.array([p.market_value for p in players])
    rho = np.corrcoef(sk, np.log(mv))[0, 1]
    print(f"\nKorrelation skill <-> log(Marktwert): {rho:.2f}")
    print("  (bewusst < 1.0: genau hier entsteht der Punkte-pro-Million-Vorteil)")

    season = simulate_full_season(players, seed=7)
    # Sanity: ein paar Spieler-Saisonsummen
    pts = [(p, actual_season_points_if_started(p.pid, season)) for p in players]
    pts.sort(key=lambda x: -x[1])
    print(f"\nTop-5 Punktelieferanten (wenn immer aufgestellt):")
    for p, s in pts[:5]:
        print(f"  {p.name} {p.position.value} | {s} Pkt | MV {p.market_value} Mio | "
              f"start_prob {p.start_prob} | {s/p.market_value:.1f} Pkt/Mio")
