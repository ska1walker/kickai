# News-Sammler — Ablauf fuer die Claude-Code-Routine

Seit 09.10.2026 der Hauptweg fuer das News-Archiv (`news_log` in Supabase).
Die Vercel-Route `/api/collect-news` bleibt als manueller Ersatz bestehen,
laeuft aber nicht mehr nach Zeitplan (sie kostet API-Guthaben, die Routine
laeuft ueber das Claude-Abo).

Zweck des Archivs: Belege fuer den **Kaderbau in der Winterpause** (4
Transfers). Gesucht sind vor allem Meldungen, die zeigen, WER SPIELT —
Einsatzzeit ist die eigentliche Punktequelle (Befund 2 in CLAUDE.md).

## Ablauf

1. `python3 scripts/news_insert.py --squad` — der eigene Kader. Diese Spieler
   gezielt pruefen (Verletzung, Startelf, Rolle), auch wenn sonst nichts los ist.
2. Mit der Websuche die wichtigsten News der **letzten 7 Tage** (taeglicher
   Lauf: letzte 48 h) zur **1. Bundesliga** sammeln. Keine 2. Liga, keine
   anderen Ligen. Gute Quellen: kicker.de, ligainsider.de, sport1.de,
   bundesliga.com, transfermarkt.de, fussballtransfers.com, reviersport.de,
   spox.com, ran.de, 90min.de. Fremdnoten (Bild, WhoScored) sind irrelevant.
3. Prioritaet:
   1. Kaderspieler (Liste aus Schritt 1)
   2. **starter**: billige Spieler (≤ 2,5 Mio), die regelmaessig von Beginn an
      spielen oder neu in die Elf gerueckt sind — das sind die Winter-Kandidaten
   3. Verletzungen & Sperren mit Dauer, Rueckkehrer
   4. Trainerwechsel und Rollenwechsel (wer ist gesetzt, wer verdraengt)
   5. Transfers nur, wenn tatsaechlich bestaetigt
4. Meldungen als JSON-Liste nach `/tmp/news.json` schreiben, ein Objekt je
   Meldung:
   ```json
   {"club": "TSG Hoffenheim", "player": "Vladimír Coufal", "type": "injury",
    "durable": false, "impact": 3,
    "summary": "Ein sachlicher Satz.", "source": "ligainsider.de"}
   ```
   - `type`: transfer_in, transfer_out, coach, injury, suspension, return,
     preseason_form, starter, other
   - `durable`: true fuer Transfer, Trainerwechsel, Sperre, Verletzung mit
     Dauer; false fuer Form, Eindruck, vage Meldungen
   - `impact`: aendert die Meldung, WER SPIELT? 4 = Stammspieler faellt lange
     aus / Torwartwechsel, 3 = aendert wahrscheinlich Aufstellungen, 2 = koennte
     relevant werden, 1 = kein Aufstellungsbezug (dann lieber weglassen)
   - Nur echte, belegte Meldungen. Nichts erfinden. Keine Geruechte ohne Substanz.
   - Ziel: 10–25 Eintraege.
5. `python3 scripts/news_insert.py /tmp/news.json` — schreibt per Upsert
   (dieselbe Story ueber Wochen wird aktualisiert, nicht verdoppelt).
6. Kontrolle: `python3 scripts/news_insert.py --check` muss eine Zahl > 0 zeigen.

## Abschluss

7. `python3 scripts/news_insert.py --kader-report` — listet JEDEN Kaderspieler
   mit seinen Meldungen der letzten 8 Tage (oder "keine Meldung"). Der Abgleich
   ist im Skript fest verdrahtet; gleiche den Kader NICHT selbst ab.

Antworte am Ende mit:
1. Anzahl geschriebener Eintraege (Ausgabe von Schritt 5).
2. Der **Kaderliste**: die Ausgabe von Schritt 7 unveraendert als Codeblock.
3. Hoechstens drei Saetze zu Auffaelligkeiten ausserhalb des Kaders
   (z. B. billige Spieler, die neu gesetzt sind — Winter-Kandidaten).

Wenn Schritt 5 oder 6 scheitert, beginne die Antwort mit **"FEHLER:"** und
nenne die Ursache — das ist das Signal, dass das Archiv eine Luecke bekommt.

Nichts committen, nichts pushen, keine anderen Tabellen anfassen.
