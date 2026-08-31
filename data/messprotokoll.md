# Messprotokoll — was der Vorsprung wirklich wert ist

Jeder Spieltag wird in vier Zahlen zerlegt. Ziel ist, die im Backtest
gefundenen Hebel an echten Daten nachzumessen, statt sie zu glauben.

**Diese Datei sammelt nur. Ein einzelner Spieltag aendert nichts** — siehe
Auswertungsregel in CLAUDE.md. Erst wenn eine Spalte ueber acht bis zehn
Spieltage in dieselbe Richtung zeigt, darf daraus ein Befund werden.

## Die vier Zahlen

| Zeile | Bedeutung |
|---|---|
| **Basis** | Kader ohne News-Einfluss, Elf allein nach erwarteten Punkten |
| **+ Kader** | mit den news-getriebenen Transfers, Elf weiterhin ohne News |
| **+ Woche** | zusaetzlich die woechentliche Aufstellungsdisziplin — das erzielte Ergebnis |
| **Optimum** | beste Elf aus demselben 22er-Kader im Rueckblick (nicht erreichbar) |

Die Differenz *Basis → + Kader* misst den Kaderbau, *+ Kader → + Woche* die
Wochenpflege, *+ Woche → Optimum* ist Varianz und Glueck.

## Messreihe

| Sp. | Basis | + Kader | + Woche | Optimum | Kader | Woche | Varianz |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 44 | 56 | **58** | 70 | **+12** | **+2** | 12 |

## Notizen je Spieltag

### Spieltag 1 (28.–30.08.2026)

Erwartet hatte die Engine 53,4 — erzielt wurden 58.

Der Kaderwert (+12) steckt fast vollstaendig in einem Tausch:
Claude-Maurice (0 Pkt) → Rieder (12 Pkt), entschieden am Freitag anhand der
voraussichtlichen Aufstellungen.

**Der Wochenwert (+2) ist nach unten verzerrt.** Es war der Saisonauftakt,
der komplette Kader wurde in derselben Woche gebaut — die News-Arbeit war
also schon eingepreist, bevor die Elf gesetzt wurde. Ab Spieltag 2, wenn der
Kader steht und nur noch aufgestellt wird, misst diese Spalte sauberer.

Varianz (12) fast vollstaendig aus zwei Spielern: Tapsoba mit Note 6,0
(−6 statt der erwarteten +8) und Millgramm, der entgegen der Prognose gar
nicht spielte (0 statt der Bank-Alternative Lemke mit 4).

Trefferquote der Aufstellungsprognosen: **10 von 11.**
Bei den billigen Stammplatz-Meldungen (`STARTER_FLOOR`): **3 von 5.**
