# Aufstellung — Ablauf fuer die Claude-Code-Routine

Seit 09.10.2026. Laeuft taeglich um 07:45 (Berlin), arbeitet aber nur, wenn
der naechste Spieltag in den naechsten 36 Stunden anfaengt — normalerweise
also Freitagmorgen, in englischen Wochen auch Dienstag/Mittwoch.

Ziel: Kai bekommt morgens eine fertig berechnete Elf, `/matchday` zeigt
dieselbe, und der Wissensstand vor Anpfiff ist im Repo eingefroren.
Kai stellt selbst im kicker auf — **kein Auto-Aufstellen** (AGB).

Arbeitsverzeichnis fuer alle Befehle: `web/`. Jeder `npx tsx`-Aufruf mit
`NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1` davor (Node-fetch braucht den Proxy).

## Ablauf

1. `npm ci --no-audit --no-fund` (einmal, ~1 min).
2. `npx tsx scripts/lineup.ts --due-hours 36`
   - Exit 3 → **nicht faellig**: sofort mit einer Zeile antworten
     ("Kein Spieltag faellig: …" mit der Ausgabe) und ENDE. Keine Recherche,
     kein Commit, keine Benachrichtigung noetig.
   - Exit 0 → weiter.
3. `npx tsx scripts/lineup.ts --dry-run` — zeigt Spieltag, Gegner,
   Anstosszeiten und den bisher gespeicherten Status (oft vom Vorspieltag).
4. **Aufstellungsnews recherchieren**, je Verein mit Kaderspielern:
   1. `python3 ../scripts/ligainsider.py` (aus `web/` heraus) — liest die
      voraussichtliche Elf jedes Vereins mit Kaderspielern direkt von
      ligainsider.de und markiert, wer IN der Prognose steht. Das ist die
      Hauptquelle (ligainsider fuehrt das Treffer-Ranking der Prognosen an).
   2. `python3 ../scripts/comunio.py` — Gegencheck aus dem Comunio-Magazin
      (Vorschau-Artikel der letzten 6 Tage): je Kaderspieler Startelf /
      Alternative in Klammern / fehlt / angeschlagen / als Option genannt.
      Dort stehen auch Ausfaelle und Angeschlagene, die ligainsider nicht zeigt.
      **Abgleich der beiden Quellen:**
      - beide Startelf → `start`
      - beide nicht in der Elf → `bench` (bei "fehlt"/"angeschlagen" → `out`
        bzw. `doubt`)
      - Quellen widersprechen sich, "Alternative in Klammern" oder "Platz
        umkaempft" → `doubt`
      - Fehlt fuer einen Verein ein Comunio-Artikel, gilt ligainsider allein.
   3. Websuche nur noch als Ergaenzung (Verletzungen kurz vor dem Spiel).
      bundesliga.com sperrt automatisierte Abrufe, kicker.de ebenso (403).
   Nur Meldungen zu DIESEM Spieltag verwenden — Datum pruefen.
   Fuer jeden Kaderspieler einen Status festlegen:
   - `start`: in der voraussichtlichen Elf
   - `doubt`: fraglich, angeschlagen, Joker mit Chance auf Startelf,
     widerspruechliche Quellen
   - `bench`: klar nicht in der Elf, aber im Kader
   - `out`: verletzt, gesperrt, abgestellt, nicht im Kader, Liga verlassen
     (Damjanovic, Kastanaras)

   Pruefregeln (aus den Spieltagen 1–5 gelernt, siehe data/messprotokoll.md):
   - **Zwei Namen fuer einen Platz**: Stehen zwei Kandidaten fuer dieselbe
     Position in einer prognostizierten Kette, ist mindestens einer falsch →
     beide hoechstens `doubt`, bis eine zweite Quelle entscheidet.
   - **Ein schlechter Spieltag ist kein Grund** fuer `bench`. Nur Aufstellungs-
     news zaehlen, nicht die letzte Note.
   - Ohne belastbare Quelle: `doubt`, nicht `start`.
5. Status als JSON nach `/tmp/status.json` (alle 22 Spieler, Namen exakt wie
   in der Tabelle aus Schritt 3), dann
   `npx tsx scripts/lineup.ts --status /tmp/status.json`
   → schreibt Status und Erwartungswerte nach Supabase und gibt die
   berechnete Elf aus. Die Elf NICHT von Hand umstellen — wenn das Ergebnis
   falsch wirkt, ist ein Status falsch; den korrigieren und neu rechnen.
6. **Spieltagsnotiz** schreiben: `data/spieltage/<saison>-md<NN>.md`
   (z. B. `2026-md06.md`; existiert sie schon, `…-md<NN>-routine.md`).
   Inhalt:
   - Kopf: "Wissensstand VOR Anpfiff, automatisch erstellt <Datum Uhrzeit>.
     Nicht nachtraeglich editieren."
   - die komplette Ausgabe von Schritt 5
   - **Status je Spieler mit Quelle** (ein Satz, woher der Status kommt)
   - **Entscheidungspunkte** nach Anstosszeit: fuer jeden `doubt` in der Elf
     und jeden Wackelkandidaten "<Tag Zeit> (Aufstellung ~1 h vor Anpfiff):
     Steht X in der Elf? Wenn nein → Y rein (spaeterer Anstoss)". Nur
     Ersatzleute nennen, die SPAETER anstossen (Abschnitt "Ersatz" der Ausgabe).
   - "Nach dem Spieltag pruefen": die 2–3 unsichersten Annahmen.
7. Commit und Push direkt nach main:
   ```
   git checkout main && git pull --ff-only
   git add data/spieltage/ && git commit -m "Spieltag <N>: Aufstellung vor Anpfiff (Routine)"
   git push origin HEAD:main
   ```
   Wird der Push nach main abgelehnt: auf den Branch `routine/spieltage`
   pushen und das in der Antwort sagen.

## Antwort (geht als Push/Mail an Kai)

1. Erste Zeile: `Spieltag <N>: <Formation>, <X> Punkte erwartet`.
2. Die Elf als kurze Liste: Position, Spieler, Spiel (vs/@ Gegner, Anstoss),
   Status — ein Spieler je Zeile.
3. Die Entscheidungspunkte aus Schritt 6.
4. Ein Satz, ob Notiz und Supabase geschrieben wurden.

Scheitert ein Schritt ab 5 (Supabase, Skript, Push), beginne die Antwort mit
**"FEHLER:"** und nenne die Ursache — Kai stellt dann von Hand auf.

Keine anderen Dateien aendern, keinen Pull Request anlegen, keine Transfers
vorschlagen (Kader ist bis zur Winterpause eingefroren).
