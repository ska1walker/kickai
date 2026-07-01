"""
Vereins-Namensauflösung
=======================
kicker-CSV und OpenLigaDB schreiben Vereine unterschiedlich
("Bor. Mönchengladbach" vs. "Borussia Mönchengladbach"). Diese Modul
bildet beide auf einen stabilen Kurz-Code ab, damit Kader (kicker) und
Spielplan (OLDB) zuverlässig gejoint werden — ohne Fuzzy-Überraschungen.
"""
from __future__ import annotations
import unicodedata

# Kanonischer Code -> Liste bekannter Schreibweisen (kicker UND OpenLigaDB).
# Deckt alle Vereine ab, die in den 4 Saisons 21/22–24/25 vorkamen.
CLUBS: dict[str, list[str]] = {
    "bayern":     ["Bayern München", "FC Bayern München"],
    "dortmund":   ["Borussia Dortmund"],
    "leverkusen": ["Bayer 04 Leverkusen"],
    "gladbach":   ["Bor. Mönchengladbach", "Borussia Mönchengladbach"],
    "frankfurt":  ["Eintracht Frankfurt"],
    "leipzig":    ["RB Leipzig"],
    "union":      ["1. FC Union Berlin"],
    "freiburg":   ["SC Freiburg"],
    "hoffenheim": ["TSG Hoffenheim", "TSG 1899 Hoffenheim"],
    "stuttgart":  ["VfB Stuttgart"],
    "wolfsburg":  ["VfL Wolfsburg"],
    "bochum":     ["VfL Bochum"],
    "mainz":      ["1. FSV Mainz 05", "Mainz 05"],
    "augsburg":   ["FC Augsburg"],
    "bremen":     ["Werder Bremen", "SV Werder Bremen"],
    "koeln":      ["1. FC Köln"],
    "heidenheim": ["1. FC Heidenheim", "1. FC Heidenheim 1846"],
    "stpauli":    ["FC St. Pauli"],
    "kiel":       ["Holstein Kiel"],
    "hsv":        ["Hamburger SV"],
    "hertha":     ["Hertha BSC"],
    "schalke":    ["FC Schalke 04"],
    "darmstadt":  ["SV Darmstadt 98"],
}


def _norm(s: str) -> str:
    """Kleinschreibung, Umlaute/Akzente weg, nur alnum — robuster Vergleich."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return "".join(c for c in s.lower() if c.isalnum())


# Vorindex: normalisierte Schreibweise -> Code
_ALIAS = {_norm(a): code for code, aliases in CLUBS.items() for a in aliases}
# zusätzlich der Code selbst als Alias (z.B. "bayern")
_ALIAS.update({_norm(code): code for code in CLUBS})


def canon(name: str | None) -> str | None:
    """Gibt den kanonischen Vereinscode zurück oder None (unbekannt)."""
    if not name:
        return None
    n = _norm(name)
    if n in _ALIAS:
        return _ALIAS[n]
    # Fallback: Teilstring-Treffer (z.B. OLDB shortName "Gladbach")
    for alias_norm, code in _ALIAS.items():
        if alias_norm and (alias_norm in n or n in alias_norm):
            return code
    return None


if __name__ == "__main__":
    tests = ["Bor. Mönchengladbach", "Borussia Mönchengladbach", "Gladbach",
             "FC Bayern München", "Bayern München", "TSG 1899 Hoffenheim",
             "1. FSV Mainz 05", "Unbekannt Verein XY"]
    for t in tests:
        print(f"  {t:<28} -> {canon(t)}")
