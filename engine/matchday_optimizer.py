"""
Spieltags-Optimierer
====================
Das produktive Herzstück. Beantwortet die Frage, die jeden Spieltag zählt:
"Welche 11 meiner 22 Kaderspieler stelle ich auf, in welcher Formation?"

Kein ML, sondern eine transparente Regel-Engine — denn der Backtest hat
gezeigt: der Gewinn kommt aus DISZIPLIN (nur spielende Spieler aufstellen),
nicht aus Vorhersage-Magie.

EINGABE pro Spieltag (das, was du Fr/Sa aus den News kennst):
  - dein Kader (22 Spieler mit Position + erwartetem Punktwert)
  - pro Spieler ein STATUS:
        "start"  -> spielt sicher von Beginn
        "doubt"  -> fraglich / Rotationskandidat
        "bench"  -> sitzt wahrscheinlich auf der Bank
        "out"    -> verletzt/gesperrt, spielt sicher nicht

AUSGABE:
  - optimale Formation + Startelf
  - Begründung je Spieler
  - Warnungen (z.B. "nur 4 sichere Stürmer-Optionen")

Diese Engine ist datenquellen-agnostisch: der Status kann manuell, aus
ligainsider-News oder später aus einer API kommen. Die Logik bleibt gleich.
"""
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum


class Pos(str, Enum):
    TW = "TW"; ABW = "ABW"; MF = "MF"; ST = "ST"


# Verfügbare Formationen (Feldspieler ohne TW)
FORMATIONS = {
    "3-4-3": {Pos.ABW: 3, Pos.MF: 4, Pos.ST: 3},
    "3-5-2": {Pos.ABW: 3, Pos.MF: 5, Pos.ST: 2},
    "4-4-2": {Pos.ABW: 4, Pos.MF: 4, Pos.ST: 2},
    "4-3-3": {Pos.ABW: 4, Pos.MF: 3, Pos.ST: 3},
    "4-5-1": {Pos.ABW: 4, Pos.MF: 5, Pos.ST: 1},
    "5-3-2": {Pos.ABW: 5, Pos.MF: 3, Pos.ST: 2},
    "5-4-1": {Pos.ABW: 5, Pos.MF: 4, Pos.ST: 1},
}

# Wie stark wir einen Status gewichten (Einsatzsicherheit = wichtigster Hebel)
STATUS_WEIGHT = {
    "start": 1.00,   # spielt sicher -> voller erwarteter Wert
    "doubt": 0.55,   # fraglich -> halber Wert, Risiko eingepreist
    "bench": 0.20,   # Bank -> nur Resthoffnung auf Einwechslung
    "out":   0.00,   # spielt nicht -> niemals aufstellen
}


@dataclass
class SquadPlayer:
    name: str
    position: Pos
    exp_points: float        # erwarteter Punktwert pro Spieltag (aus Saisonschnitt)
    status: str = "doubt"    # start/doubt/bench/out für DIESEN Spieltag

    @property
    def effective_value(self) -> float:
        return self.exp_points * STATUS_WEIGHT.get(self.status, 0.0)


def optimize_matchday(squad: list[SquadPlayer]):
    """Findet Formation + Startelf, die den erwarteten Punktwert maximiert.
       Stellt NIE einen 'out'-Spieler auf. Bevorzugt 'start' vor 'doubt'."""
    # Torwart: bester verfügbarer (nicht out)
    keepers = sorted([p for p in squad if p.position == Pos.TW and p.status != "out"],
                     key=lambda p: -p.effective_value)
    if not keepers:
        return {"error": "Kein einsatzfähiger Torwart im Kader!"}
    gk = keepers[0]

    best = None
    for fname, need in FORMATIONS.items():
        lineup = [gk]
        feasible = True
        notes = []
        for pos, k in need.items():
            pool = sorted([p for p in squad if p.position == pos and p.status != "out"],
                          key=lambda p: -p.effective_value)
            if len(pool) < k:
                feasible = False
                notes.append(f"zu wenige {pos.value} ({len(pool)}/{k})")
                break
            lineup += pool[:k]
        if not feasible:
            continue
        total = sum(p.effective_value for p in lineup)
        if best is None or total > best["score"]:
            best = {"formation": fname, "lineup": lineup, "score": total}

    if best is None:
        return {"error": "Keine gültige Formation füllbar — Kader zu dünn besetzt."}

    # Begründung + Warnungen
    result = {
        "formation": best["formation"],
        "expected_points": round(best["score"], 1),
        "lineup": [],
        "warnings": [],
    }
    for p in best["lineup"]:
        flag = {"start": "✓ gesetzt", "doubt": "⚠ fraglich",
                "bench": "↑ Bank-Wette", "out": "✗"}[p.status]
        result["lineup"].append({
            "name": p.name, "pos": p.position.value,
            "status": flag, "exp": round(p.exp_points, 1),
        })

    # Warnung: fragliche Spieler in der Elf
    doubts = [p for p in best["lineup"] if p.status == "doubt"]
    if doubts:
        result["warnings"].append(
            f"{len(doubts)} fragliche Spieler in der Startelf "
            f"({', '.join(p.name for p in doubts)}) — vor Anpfiff News prüfen!")
    # Warnung: dünne Optionen
    for pos in [Pos.ABW, Pos.MF, Pos.ST]:
        safe = [p for p in squad if p.position == pos and p.status == "start"]
        if len(safe) <= 1:
            result["warnings"].append(
                f"Nur {len(safe)} sicherer {pos.value}-Spieler — Engpass-Risiko.")
    return result


def print_result(res):
    if "error" in res:
        print("FEHLER:", res["error"]); return
    print(f"\n  EMPFOHLENE AUFSTELLUNG — Formation {res['formation']}")
    print(f"  Erwarteter Punktwert: {res['expected_points']}")
    print("  " + "-"*46)
    order = {"TW": 0, "ABW": 1, "MF": 2, "ST": 3}
    for p in sorted(res["lineup"], key=lambda x: order[x["pos"]]):
        print(f"  {p['pos']:<4} {p['name']:<18} {p['status']:<12} (~{p['exp']} Pkt)")
    if res["warnings"]:
        print("\n  HINWEISE:")
        for w in res["warnings"]:
            print(f"   • {w}")


if __name__ == "__main__":
    # Demo mit einem Beispiel-Kader
    demo = [
        SquadPlayer("Batz", Pos.TW, 4.4, "start"),
        SquadPlayer("Backup-TW1", Pos.TW, 0.5, "bench"),
        SquadPlayer("Backup-TW2", Pos.TW, 0.3, "bench"),
        SquadPlayer("Coufal", Pos.ABW, 7.0, "start"),
        SquadPlayer("Vuskovic", Pos.ABW, 6.3, "start"),
        SquadPlayer("Elvedi", Pos.ABW, 4.8, "start"),
        SquadPlayer("Hranac", Pos.ABW, 4.1, "doubt"),
        SquadPlayer("Querfeld", Pos.ABW, 3.6, "start"),
        SquadPlayer("ABW-Bank1", Pos.ABW, 1.0, "bench"),
        SquadPlayer("ABW-Bank2", Pos.ABW, 0.8, "out"),
        SquadPlayer("Baumgartner", Pos.MF, 7.5, "start"),
        SquadPlayer("Kramaric", Pos.MF, 8.1, "start"),
        SquadPlayer("El Mala", Pos.MF, 6.5, "start"),
        SquadPlayer("Prömel", Pos.MF, 5.4, "doubt"),
        SquadPlayer("Maza", Pos.MF, 5.2, "start"),
        SquadPlayer("Uzun", Pos.MF, 4.1, "bench"),
        SquadPlayer("MF-Bank", Pos.MF, 2.0, "bench"),
        SquadPlayer("Diomande", Pos.ST, 8.0, "start"),
        SquadPlayer("Touré", Pos.ST, 5.7, "start"),
        SquadPlayer("Lemperle", Pos.ST, 4.7, "doubt"),
        SquadPlayer("Ansah", Pos.ST, 3.6, "bench"),
        SquadPlayer("ST-Bank", Pos.ST, 1.5, "out"),
    ]
    print("="*50)
    print("  SPIELTAGS-OPTIMIERER — Demo")
    print("="*50)
    print_result(optimize_matchday(demo))
