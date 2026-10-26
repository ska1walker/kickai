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
| 2 | 59 | 59 | **61** | 65 | — | **+2** | 4 |
| 3+4 | — | — | **80** (zusammen, Ø 40) | — | — | — | — |
| 5, 6 | — | — | (noch nicht eingetragen) | — | — | — | — |
| 7 | 36 | 36 | **59** | 63 | — | **+23** | 4 |

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

### Spieltag 2 (04.–06.09.2026)

61 Punkte, erwartet waren 55,0.

**Kein Transfer benutzt** — Basis und "+ Kader" fallen deshalb zusammen. Das
ist die erste SAUBERE Messung der Wochendisziplin: der Kader war unveraendert,
gemessen wird nur noch die Aufstellung. Ergebnis **+2 Punkte**, exakt wie an
Spieltag 1.

Die Disziplin bestand aus zwei Eingriffen:
- **El Mala raus** (kicker-Symbol: Ausfall). Er kam nicht zum Einsatz und holte
  0; Koeln verlor 1:4 in Stuttgart. Ohne den Eingriff waere ein Elf-Platz leer
  geblieben.
- **ter Horst rein statt Lemke** ueber die neue Gleichstandsregel (frueherer
  Anstoss haelt den spaeteren als Ersatz frei). Beide holten exakt 2 Punkte —
  die Regel war fuer das Ergebnis neutral, wie angekuendigt. Sie zahlt auf
  Optionalitaet ein, nicht auf Erwartungswert.

**Die Auswertungsregel hat sich sofort ausgezahlt.** Tapsoba, nach seiner 6,0
an Spieltag 1 der naheliegendste Verkaufskandidat, holte 6 Punkte. Aleix Garcia
sprang von 0 auf 10. Wer nach einem Spieltag getauscht haette, haette beide
Erholungen verpasst und einen von vier Transfers verbrannt.

Bester Mann erneut **Rieder mit 14** (nach 12) — 2,40 Mio, der Tausch gegen
Claude-Maurice traegt weiter. **Lemperle 15** im ersten Spiel nach der Sperre.

Varianz nur noch 4 Punkte zum Optimum (Vorwoche 12): Rondic haette als zweiter
Stuermer 2 Punkte mehr gebracht als der vierte Mittelfeldplatz, ter Horst und
Tapsoba waren nicht zu verbessern.

**Quellen-Kalibrierung: 9 von 10** als gesetzt aufgestellten Spielern standen
wirklich in der Startelf (Spieltag 1: 10 von 11). Die eine Fehlprognose:

**da Costa.** Stefan Posch hat ihn bei Mainz aus der Startelf verdraengt; er kam
erst in der 81. Minute fuer Caci, daher genau +2 fuer die Einwechslung und keine
Note. Das war keine Tagesform-Rotation — Mainz fehlten Zentner, Widmer UND Kohr,
und er stand trotzdem draussen. Das spricht fuer eine neue Rangordnung.

Der Fehler war vermeidbar: Dieselbe ligainsider-Recherche, die da Costa in der
Elf listete, enthielt den Satz, dass Mainz Posch zurueckgeholt hat und ihn als
gesetzt sieht. **Beide Namen standen in einer Viererkette, in der nur einer Platz
hat.** Daraus die Regel fuer den Donnerstagslauf: stehen zwei Kandidaten fuer
dieselbe Position in einer prognostizierten Kette, ist mindestens einer falsch.

Gekostet hat die Fehlprognose diesmal **nichts**: da Costa +2, Lemke +2 (ebenfalls
nur eingewechselt), Schmetgens +2 (Startelf, Note 4,0). Alle drei Verteidiger
lieferten identisch. Auch die neue Gleichstandsregel bestaetigt sich nebenbei —
ter Horst stand in der Startelf, Lemke wurde nur eingewechselt.

Konsequenz fuer Spieltag 3: da Costa steht auf `doubt`, bis ihn eine Aufstellung
wieder in der Elf zeigt. Transferieren ist nicht moeglich, der Kader ist bis zur
Winterpause eingefroren.

**Kadereingriff von aussen:** Damjanovic (Leverkusen) und Kastanaras (Augsburg)
sind aus der kicker-Liste verschwunden — beide 0,50-Mio-Bankspieler ohne eine
Einsatzminute. Der Kader steht dadurch bei 20 Spielern mit nur 3 Stuermern.
Nachbesetzen ist NICHT moeglich: kicker gibt fuer Liga-Abgaenger weder Ersatz
noch Geld zurueck, und das naechste Transferfenster ist erst die Winterpause
(26/27 faellt das Deadline-Day-Fenster fuer die Bundesliga aus). Der Kader ist
bis dahin eingefroren — ab jetzt ist die woechentliche Aufstellung der EINZIGE
verbleibende Hebel.

### Spieltag 3 und 4 (12.–20.09.2026) — nur zusammen auswertbar

**Luecke, und zwar meine.** Beide Spieltage wurden nie ausgewertet, und sie
lassen sich nicht mehr trennen: Der Punkte-Waechter speicherte nur die
Liga-Summe je Freigabe, keine Spielerwerte. Rekonstruierbar ist deshalb nur
die Differenz zum Stand nach Spieltag 2.

Behoben am 29.09.2026: `watch_scores.py` schreibt bei jeder Freigabe einen
vollstaendigen Abzug nach `data/punkte/<saison>-<zeit>.json` (Punkte und Note
aller Spieler). Ab Spieltag 5 ist die Trennung damit wieder moeglich; ein
Basis-Abzug vom Stand nach Spieltag 4 liegt vor.

**Ergebnis: 80 Punkte in zwei Spieltagen, also Ø 40.**
Nach 58 (ST1) und 61 (ST2) ist das ein deutlicher Einbruch. Die aufgestellte
Elf war an beiden Spieltagen personell identisch.

| | Pkt (ST3+4) | |
|---|---|---|
| Tapsoba | +18 | |
| Rieder | +16 | traegt weiter |
| **da Costa** | **+13** | **auf unserer Bank** |
| Aleix Garcia | +12 | |
| Raum | +10 | |
| ter Horst | +8 | |
| Coufal / El Mala | je +6 | |
| Kramaric / Lemperle | je +4 | |
| Nicolas | **0** | |
| R. Khedira | **−4** | |

Auf der Bank lagen zusammen **19 Punkte** (da Costa 13, Schmetgens 4, Lemke 2).

**Nicolas, 0 Punkte in zwei Spielen.** Nicht verletzt — er spielte beide Male,
aber Gladbach kassierte 0:5 gegen Freiburg und 3:4 gegen Mainz. Bei Note ~4,5
je Spiel bleibt exakt der Startbonus uebrig. Dazu ein Trainerwechsel: unter
Blessin wurde Nicolas zwischenzeitlich geschont. Er ist mit 3,00 Mio der
zweitteuerste Spieler im Kader und liefert derzeit am wenigsten.
→ Kandidat Nr. 1 fuer die Winterpause.

**da Costa bleibt trotz der 13 Punkte zu Recht auf der Bank.** Fuer Spieltag 5
steht er NICHT in Mainz' voraussichtlicher Elf; Posch spielt rechts, und
da Costa hat oeffentlich zu seiner "neuen Joker-Rolle" Stellung genommen. Die
Punkte kamen aus Einwechslungen und einem starken Schnitt (Note 2,83), nicht
aus einem zurueckeroberten Stammplatz.

**Khedira** verlor auswaerts in Muenchen (0:7 fuer Union an ST4). Er steht fuer
Spieltag 5 weiter in der Startelf; kein Handlungsbedarf, aber sein Wert haengt
stark am Gegner.

### Spieltag 7 (23.–25.10.2026)

**59 Punkte** (Annahme: der Samstags-Tausch Raum → Kramaric wurde gemacht;
ohne ihn waeren es 36). Optimum aus dem Kader: 63 (4-5-1). Erster Spieltag,
an dem die Routine "Aufstellung" die Elf berechnet hat (5-4-1, 54,3 erwartet).

Zahlen aus der kicker-CSV (Stand 26.10. 10:18 UTC) minus Saisonstand nach
Spieltag 6 aus `data/spieltage/2026-md07.md`.

| Spieler | Pkt | |
|---|---:|---|
| Nicolas | 2 | |
| Coufal | 6 | |
| Tapsoba | 2 | |
| da Costa | 0 | stand in der Startelf, schwache Note |
| ter Horst | 6 | |
| Rieder | 10 | bester Startelf-Spieler, 68 Saisonpunkte |
| Aleix Garcia | 0 | |
| S. El Mala | 6 | |
| R. Khedira | 4 | |
| **Kramaric** | **23** | fuer Raum reingenommen, kam von der Bank |
| Lemperle | 0 | Bank, nicht eingesetzt |
| *Raum* | *0* | *nicht in der Leipziger Startelf → rausgenommen* |

**Die Wochendisziplin hat diesmal den Spieltag entschieden: +23.** Die
Routine-Elf vom Freitagmorgen haette 36 geholt. Den Unterschied machte ein
einziger Eingriff am Samstag um 14:35: Raum fehlte in der offiziellen
Leipziger Elf, fuer die Abwehr gab es keinen spaeteren Ersatz, also kam
Kramaric (So 15:30) ins Mittelfeld. Kramaric wurde dann zwar nur
eingewechselt, holte aber 23. Der Ertrag ist Glueck in der Hoehe — aber die
Entscheidung war auch mit 2 Punkten richtig, weil Raum mit 0 sicher war.
Gemaess Auswertungsregel ist das EIN Datenpunkt, kein Beleg; er zeigt aber
genau den Mechanismus aus Befund 5 (nur spielende Spieler aufstellen).

**Quellen-Kalibrierung (Prognose Fr/Sa vs. Startelf):**
- Raum: ligainsider und Comunio sahen ihn am Freitag in der Elf — falsch.
  Erst die offizielle Aufstellung (Sa ~14:30) zeigte es.
- Kramaric: kicker und ligainsider sahen ihn in der Startelf, Comunio nicht —
  Comunio lag richtig (Bank). Gepunktet hat er trotzdem.
- Lemperle: kicker sah ihn auf der Bank, die anderen in der Elf — der kicker
  lag richtig.
- Die uebrigen neun Starter stimmten.
Fazit fuer die Routine: die Freitagsprognose allein reicht nicht, der
Samstags-/Sonntags-Check der offiziellen Aufstellung ist der eigentliche Hebel.

**Fuer den Kader (Winterpause):** Lemperle ist der einzige einsatzfaehige
Stuermer. Faellt er aus der Elf, gibt es keinen Ersatz — Millgramm, Rondic,
Damjanovic, Kastanaras liefern null. Das ist der klarste Transferbedarf.
