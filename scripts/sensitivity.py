"""
Sensitivitätsanalyse
====================
Die kritischste Annahme ist, WIE STARK der Marktwert von der echten Qualität
abweicht (Hype/Prominenz). Und wie stark Stars rotieren. Wir variieren beides
und prüfen, ob die Reihenfolge C > B > A stabil bleibt.

Wenn das Ergebnis nur bei genau einer Annahme gilt, ist es wertlos.
Wenn es über einen breiten Bereich gilt, können wir ihm trauen.
"""
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "engine"))
import numpy as np
import importlib
import season as season_mod
from scoring import score_performance
from strategies import (pick_squad_stars, pick_squad_pptm,
                        lineup_static, lineup_active, play_season, squad_cost)


def build_universe_param(seed, mv_noise, star_rotation):
    """Wie build_universe, aber mit einstellbarem Marktwert-Rauschen und
       Star-Rotation. mv_noise hoch = Marktwert sagt wenig über Qualität.
       star_rotation hoch = teure Spieler fallen öfter aus."""
    from season import Player, Position, UNIVERSE
    rng = np.random.default_rng(seed)
    players = []
    pid = 0
    for pos, n in UNIVERSE.items():
        for i in range(n):
            club = rng.integers(0, 18)
            skill = float(np.clip(rng.beta(2.2, 2.2), 0.02, 0.98))
            exp_note = 4.0 - skill * 1.9
            pos_premium = {Position.TW:0.85, Position.ABW:0.9,
                           Position.MF:1.05, Position.ST:1.45}[pos]
            noise = rng.normal(0, mv_noise)
            base = (skill + noise) * pos_premium
            mv = float(np.clip(np.exp(base*2.6)*0.25, 0.15, 22.0))
            base_start = 0.45 + skill*0.5
            # Star-Rotation: je höher skill, desto mehr Ausfall-Risiko (regelbar)
            rot = rng.uniform(0, 0.18) + (skill * star_rotation)
            sp = float(np.clip(base_start - rot, 0.25, 0.97))
            grate = {Position.TW:0.0, Position.ABW:0.06,
                     Position.MF:0.14, Position.ST:0.42}[pos]*(0.4+skill)
            arate = {Position.TW:0.0, Position.ABW:0.05,
                     Position.MF:0.16, Position.ST:0.18}[pos]*(0.4+skill)
            players.append(Player(pid, f"{pos.value}{i:03d}", pos, int(club),
                skill, round(mv,2), round(sp,3), float(grate), float(arate),
                round(exp_note,3)))
            pid += 1
    return players


def run_scenario(mv_noise, star_rotation, n_seasons=20):
    diffs_CA, diffs_CB, c_wins = [], [], 0
    rhos = []
    for k in range(n_seasons):
        players = build_universe_param(100+k, mv_noise, star_rotation)
        sk = np.array([p.skill for p in players])
        mv = np.array([p.market_value for p in players])
        rhos.append(np.corrcoef(sk, np.log(mv))[0,1])
        season = season_mod.simulate_full_season(players, seed=500+k)
        stars = pick_squad_stars(players)
        pptm = pick_squad_pptm(players)
        A,_ = play_season(stars, season, lineup_static)
        B,_ = play_season(pptm, season, lineup_static)
        C,_ = play_season(pptm, season, lineup_active)
        diffs_CA.append(C-A); diffs_CB.append(C-B)
        if C > A: c_wins += 1
    return (np.mean(diffs_CA), np.mean(diffs_CB),
            100*c_wins/n_seasons, np.mean(rhos))


if __name__ == "__main__":
    print("="*74)
    print("  SENSITIVITÄT: bleibt C (aktiv) vorn, egal wie die Welt aussieht?")
    print("="*74)
    print(f"\n{'MV-Rausch':>10}{'Star-Rot':>10}{'rho(skill,MV)':>15}"
          f"{'C-A Pkt':>10}{'C-B Pkt':>10}{'C gewinnt':>11}")
    print("-"*74)
    # Szenarien: von "Marktwert sagt fast alles" bis "Marktwert ist fast Hype"
    for mv_noise in [0.15, 0.32, 0.5, 0.7]:
        for star_rot in [0.0, 0.15, 0.30]:
            ca, cb, win, rho = run_scenario(mv_noise, star_rot, n_seasons=20)
            print(f"{mv_noise:>10.2f}{star_rot:>10.2f}{rho:>15.2f}"
                  f"{ca:>10.0f}{cb:>10.0f}{win:>10.0f}%")
    print("-"*74)
    print("  Lesart: rho hoch = Marktwert ist ehrlich; rho niedrig = viel Hype.")
    print("  star_rot hoch = teure Spieler fallen häufiger aus.")
    print("  Wenn 'C gewinnt' überall hoch ist -> These ist robust.")
    print("="*74)
