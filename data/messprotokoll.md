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
