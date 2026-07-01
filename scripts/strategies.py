"""
Manager-Strategien + Spieltags-Optimierer
==========================================
Hier treten die Ansätze gegeneinander an. Jede Strategie besteht aus:
  1. KADER-AUSWAHL  (welche 22 Spieler kaufe ich mit 42,5 Mio?)
  2. SPIELTAGS-AUFSTELLUNG (welche 11 stelle ich jeden Spieltag?)

Die Strategien:
  A) "Stars"        -> teuerste gültige Elf (Bauchgefühl-Manager)
  B) "PptM-static"  -> Punkte/Mio-Kader, aber Aufstellung fix (set-and-forget)
  C) "PptM-active"  -> Punkte/Mio-Kader + WÖCHENTLICHES Mikromanagement
                       (tausche Spieler raus, die diesen Spieltag nicht spielen)

C ist die These dieses Projekts. Wir messen den Abstand zu A und B.

WICHTIG zur Fairness: Keine Strategie darf "in die Zukunft schauen". Die
Kaderauswahl nutzt nur Information, die VOR Saisonstart plausibel verfügbar
ist (Vorsaison-Erwartung = exp_note_mean + start_prob + Marktwert). Das
Mikromanagement nutzt nur, ob ein Spieler an DIESEM Spieltag im Aufgebot
steht (das weiß man real Fr/Sa aus den voraussichtlichen Aufstellungen) —
nicht seine Note.
"""
from __future__ import annotations
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "engine"))
import numpy as np
from scoring import Position, score_performance
from season import Player, SQUAD_REQ, BUDGET, simulate_full_season, build_universe

FORMATIONS = {
    "3-4-3": {Position.ABW: 3, Position.MF: 4, Position.ST: 3},
    "3-5-2": {Position.ABW: 3, Position.MF: 5, Position.ST: 2},
    "4-4-2": {Position.ABW: 4, Position.MF: 4, Position.ST: 2},
    "4-3-3": {Position.ABW: 4, Position.MF: 3, Position.ST: 3},
    "4-5-1": {Position.ABW: 4, Position.MF: 5, Position.ST: 1},
    "5-3-2": {Position.ABW: 5, Position.MF: 3, Position.ST: 2},
    "5-4-1": {Position.ABW: 5, Position.MF: 4, Position.ST: 1},
}
# 1 TW immer gesetzt; Feld = 10 Spieler nach Formation


# ---------- erwarteter Punktwert eines Spielers (Pre-Season-Schätzung) ----------
def expected_season_points(p: Player) -> float:
    """Schätzt Saisonpunkte aus VOR Saisonstart bekannten Größen.
       Kein Blick in die echten Spieltagsdaten."""
    from scoring import note_to_points, GOAL_POINTS
    note_pts = note_to_points(round(p.exp_note_mean * 2) / 2)
    per_start = 4 + note_pts + p.goal_rate * GOAL_POINTS[p.position] + p.assist_rate
    return per_start * p.start_prob * 34


# ---------- KADER-AUSWAHL ----------
def _greedy_squad(players, score_fn):
    """Wählt 22 gültige Spieler (3/6/8/5) unter Budget, greedy nach score_fn/Mio
       bzw. score_fn, je nach Strategie. Gibt squad-Liste zurück."""
    squad = []
    for pos, need in SQUAD_REQ.items():
        pool = [p for p in players if p.position == pos]
        pool.sort(key=lambda p: -score_fn(p))
        squad += pool[:need]
    # Budget einhalten? Greedy-Fallback: teuerste gegen billigere tauschen
    return squad


def pick_squad_stars(players):
    """Teuerste gültige Elf-Logik: priorisiere hohen Marktwert.
       Realistischer Bauchgefühl-Manager: er kauft Namen bis das Geld alle ist
       und füllt den Rest mit Pflicht-Billigspielern."""
    squad = []
    remaining = BUDGET
    for pos, need in SQUAD_REQ.items():
        pool = sorted([p for p in players if p.position == pos],
                      key=lambda p: -p.market_value)
        picked = []
        # erst so viele teure wie möglich, Rest billig auffüllen
        for p in pool:
            if len(picked) >= need:
                break
        # nimm die teuersten, solange Budget reicht, sonst billigste
        idx = 0
        while len(picked) < need:
            # Budget-Check: brauche ich Reserve für noch fehlende Pflichtplätze?
            still_needed_total = sum(SQUAD_REQ[pp] for pp in SQUAD_REQ) \
                                 - (len(squad) + len(picked)) - 1
            cheapest_later = 0.2 * max(still_needed_total, 0)
            cand = None
            for p in pool:
                if p in picked:
                    continue
                if p.market_value <= remaining - cheapest_later:
                    cand = p
                    break
            if cand is None:
                # nimm billigsten verfügbaren
                cand = min([p for p in pool if p not in picked],
                           key=lambda p: p.market_value)
            picked.append(cand)
            remaining -= cand.market_value
        squad += picked
    return squad


def pick_squad_pptm(players):
    """Punkte-pro-Million-Strategie: maximiere erwartete Saisonpunkte pro €,
       aber sichere eine schlagkräftige Stamm-Elf (Hantel-Prinzip).
       Vorgehen: pro Position die effizientesten Stammspieler, Bank zum Minimum."""
    squad = []
    remaining = BUDGET

    # Wie viele "Stammspieler" pro Position wir mit Qualität bestücken wollen
    # (Rest = billigste Pflicht-Auffüllung). Summe Feld-Stamm ~ 11-13.
    core = {Position.TW: 1, Position.ABW: 4, Position.MF: 5, Position.ST: 3}

    for pos, need in SQUAD_REQ.items():
        pool = [p for p in players if p.position == pos]
        # Effizienz = erwartete Punkte / Marktwert, aber mit Mindest-Qualität
        for p in pool:
            p._eff = expected_season_points(p) / max(p.market_value, 0.15)
            p._exp = expected_season_points(p)
        n_core = core[pos]
        # Core: beste Effizienz, aber nur Spieler mit ordentlicher Einsatzquote
        core_pool = sorted([p for p in pool if p.start_prob >= 0.6],
                           key=lambda p: -p._eff)
        picked = []
        for p in core_pool:
            if len(picked) >= n_core:
                break
            # Reserve für Pflicht-Auffüllung der restlichen Plätze
            still = (sum(SQUAD_REQ.values()) - (len(squad)+len(picked)) - 1)
            if p.market_value <= remaining - 0.18*still:
                picked.append(p); remaining -= p.market_value
        # Auffüllen bis need mit BILLIGSTEN, die trotzdem spielen
        fill_pool = sorted([p for p in pool if p not in picked],
                           key=lambda p: (p.market_value, -p.start_prob))
        for p in fill_pool:
            if len(picked) >= need:
                break
            picked.append(p); remaining -= p.market_value
        squad += picked
    return squad


# ---------- SPIELTAGS-AUFSTELLUNG ----------
def _best_formation_lineup(available, expected_pts_fn):
    """Wählt aus den verfügbaren Spielern die Formation + 11, die die höchste
       Summe an expected_pts_fn ergibt. 1 TW + 10 Feld nach Formation."""
    tws = sorted([p for p in available if p.position == Position.TW],
                 key=lambda p: -expected_pts_fn(p))
    if not tws:
        return None, None
    best = None
    for fname, need in FORMATIONS.items():
        lineup = [tws[0]]
        ok = True
        for pos, k in need.items():
            pool = sorted([p for p in available if p.position == pos],
                          key=lambda p: -expected_pts_fn(p))
            if len(pool) < k:
                ok = False; break
            lineup += pool[:k]
        if not ok:
            continue
        total = sum(expected_pts_fn(p) for p in lineup)
        if best is None or total > best[2]:
            best = (fname, lineup, total)
    if best is None:
        return None, None
    return best[0], best[1]


def lineup_static(squad, season, md):
    """Set-and-forget: immer dieselbe beste 11 nach Pre-Season-Erwartung,
       egal wer real spielt. (Der häufigste Fehler.)"""
    fname, lineup = _best_formation_lineup(squad, expected_season_points)
    return lineup


def lineup_active(squad, season, md):
    """Mikromanagement: kenne (real, Fr/Sa) wer DIESEN Spieltag im Aufgebot
       steht. Stelle nur Spieler auf, die auch spielen. Unter denen wähle nach
       Pre-Season-Erwartung (Note kennen wir VORHER nicht)."""
    day = season[md]
    def plays_today(p):
        perf = day[p.pid]
        return perf.started or perf.came_on
    # nur verfügbare Spieler, bevorzugt Starter
    def avail_score(p):
        perf = day[p.pid]
        boost = 1.0 if perf.started else (0.4 if perf.came_on else 0.0)
        return expected_season_points(p) * boost
    available = [p for p in squad if plays_today(p)]
    fname, lineup = _best_formation_lineup(available, avail_score)
    if lineup is None:
        # Notnagel: falls Formation nicht füllbar, nimm statische Elf
        return lineup_static(squad, season, md)
    return lineup


# ---------- SAISON SPIELEN ----------
def play_season(squad, season, lineup_fn, n_md=34):
    total = 0
    weekly = []
    for md in range(1, n_md + 1):
        lineup = lineup_fn(squad, season, md)
        pts = sum(score_performance(season[md][p.pid], "start") for p in lineup)
        total += pts
        weekly.append(pts)
    return total, weekly


def squad_cost(squad):
    return sum(p.market_value for p in squad)
