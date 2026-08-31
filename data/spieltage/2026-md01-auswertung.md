# Spieltag 1 26/27 — Auswertung

Getrennte Datei, weil `2026-md01.md` den Wissensstand VOR Anpfiff einfriert
und nicht nachtraeglich editiert wird. Freigabe der Punkte durch kicker:
**Montag 31.08., 09:35 Uhr** (vom Punkte-Waechter protokolliert).

## Ergebnis

**58 Punkte erzielt, 53,4 erwartet — Abweichung +4,6.**
Bestmoeglich aus dem eigenen Kader waeren 70 gewesen, ebenfalls in 5-4-1.
Die Formation war also richtig, zwei Spieler waren es nicht.

| Spieler | Pkt | Note | |
|---|---|---|---|
| Nicolas | 10 | 2,0 | |
| Coufal | 8 | 3,0 | + Assist |
| Raum | 8 | 2,5 | |
| Tapsoba | **−6** | **6,0** | schlechteste Note der Liga |
| da Costa | 8 | 2,5 | |
| ter Horst | 4 | 3,5 | |
| Aleix Garcia | 0 | 4,5 | |
| S. El Mala | 10 | 3,0 | + Tor |
| R. Khedira | 4 | 3,5 | |
| Rieder | **12** | 2,0 | + Assist, bester Spieler |
| A. Millgramm | **0** | — | **nicht gespielt** |

## Kalibrierung der Quellen

**10 von 11 prognostizierten Startelfspielern haben wirklich begonnen (91 %).**
Der eine Fehler: Millgramm. Bei den billigen Stammplatz-Meldungen
(`STARTER_FLOOR`) war die Trefferquote 3 von 5 — ter Horst, Lemke und
Schmetgens begannen, Millgramm und Schnitzer nicht. Die Quellenlage ist gut
genug, um darauf zu planen, aber nicht gut genug, um ohne Reserve zu planen.

## Die Entscheidungen

| Entscheidung | Ausgang |
|---|---|
| Claude-Maurice → **Rieder** | **+12** — Rieder bester Mann, Claude-Maurice 0 |
| Prass → **Kramaric** | +2 — Kramaric eingewechselt, Prass 0 |
| Millgramm statt Damjanovic | ±0 — beide 0 |
| **Tapsoba behalten** statt Schlotterbeck | **−6** — der abgelehnte Tausch waere richtig gewesen |

Wichtig fuer die Bewertung: Der Tapsoba-Fehler war keine Fehlanalyse. Der
Grund gegen den Tausch war richtig (Tapsoba ist bestaetigter Kapitaen und
Stammspieler), er hat nur eine 6,0 gespielt. Genau das ist die Varianz, die
sich nicht wegoptimieren laesst — und der Grund, warum die Strategie auf
Einsatzzeit setzt und nicht auf Notenprognosen.

Kramaric war entgegen dem kicker-Symbol im Kader und wurde eingewechselt.
Die Entscheidung, ihn nicht zu verkaufen, hat sich bestaetigt.

## Regelfund: Assist = +2, nicht +1

An 285 bewerteten Spielern gegen `Start(+4) + (3,5−Note)·4` gerechnet:
153 Spieler mit Residuum 0, 23 mit −2 (Einwechslungen), **20 mit +2** —
davon nur 4 Zu-null-Torhueter, die restlichen 16 ueber alle Vereine und
Positionen verstreut. Der +1-Bereich war mit einem einzigen Spieler
praktisch leer. Gegenprobe: Raum, da Costa und ter Horst standen alle in
Zu-null-Teams und hatten Residuum 0 — einen Zu-null-Bonus fuer Verteidiger
gibt es also nicht.

`ASSIST_POINTS` in `engine/scoring.py` korrigiert (war 1).

## Korrelationen — der Kernbefund praeziser

| | ein Spieltag | ganze Saison |
|---|---|---|
| Korr(Note, Punkte) | **−0,94** | ~0,01 |
| Korr(Marktwert, Punkte) | 0,22 | 0,62–0,70 |

Das ist kein Widerspruch, sondern der Mechanismus dahinter. An einem
einzelnen Spieltag bestimmt die Note die Punkte fast vollstaendig (negativ,
weil kleine Note = gut). Ueber eine Saison verschwindet dieser Zusammenhang,
weil die Note nicht kumuliert — jeder pendelt um seinen Schnitt. Was
kumuliert, ist die Zahl der Einsaetze. Deshalb ist die Note fuer die
Kaderplanung wertlos und fuer die Aufstellung unvorhersagbar.

Praktische Folge: Die Jagd nach frueheren Noten bleibt uninteressant. Was
zaehlt, ist weiterhin die Aufstellungsnews vor dem Spiel.
