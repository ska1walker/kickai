# CLAUDE.md — Projekt-Briefing für Claude Code

> Dieses Dokument gibt dir (Claude Code) den vollständigen Kontext. Lies es
> zuerst. Es fasst zusammen, was gebaut wurde, was die echten Daten zeigen,
> welche Befunde gesichert sind und was als Nächstes ansteht.

## Worum es geht

Ziel: Eine **private Liga im kicker-Managerspiel Interactive (Bundesliga)
gewinnen**. Nutzer ist Kai (kaivo.studio). Das Spiel ist im Kern ein
Optimierungsproblem, kein Fußball-Quiz.

**Spielregeln (verifiziert, Stand 2024/25):**
- 22-Mann-Kader: 3 TW, 7 ABW, 7 MF, 5 ST. Budget 42,5 Mio €.
- Marktwerte fix über die Saison. Nur die aufgestellte Startelf (11) zählt.
- Punkte: Start +4, Einwechslung +2, kicker-Note (1.0=+10 … 6.0=−10),
  Tore (TW 6 / ABW 5 / MF 4 / ST 3), **Assist +2** (an Spieltag 1 26/27
  empirisch verifiziert; die frueher notierten +1 waren falsch), Zu-null-TW +2,
  Spieler des Spiels +3, Gelb-Rot −3, Rot −6.
- Aufstellung bis zum jeweiligen Anpfiff änderbar (Mikromanagement-Fenster).
- Nur 4 Transfers/Saison (1 nach Deadline Day, bis 4 in Winterpause).

## Die gesicherten Befunde (aus echter 2025/26-Saison, 563 Spieler)

Datenquelle: kicker-Export-CSV (Host braucht `www.` — sonst NXDOMAIN!)
`https://www.kicker-libero.de/api/sportsdata/v1/players-details/se-k0001<Startjahr>.csv`
**WICHTIG — Namenskonvention:** die Zahl ist das Saison-STARTjahr (verifiziert
über Auf-/Absteiger). `se-k00012025` = Saison **2025/26**, NICHT 24/25! Der
Hauptdatensatz, den frühere Notizen „24/25" nannten, ist in Wahrheit die
komplette Saison 25/26. Gezogen liegen **4 Saisons** vor:
`se-k00012022`=22/23, `2023`=23/24, `2024`=24/25, `2025`=25/26,
`se-k00012026`=26/27 (**seit Aug 2026 verfügbar, gezogen — die AKTIVE Saison**).
Auf-/Absteiger 26/27: + Schalke, Paderborn, Elversberg / − Heidenheim,
St. Pauli, Wolfsburg. WICHTIG: kicker befüllt die Punkte-Spalte der neuen
Saison mit den VORSAISON-Punkten vor — auch für Rückkehrer ohne 25/26-Eintrag
(Boey, Adamu …); build_pool nutzt das als zweite Bridge-Quelle. ACHTUNG
Sentinel: MV=999 Mio = „kein Marktwert gelistet" (v.a. 24/25-Datei) → filtern.

1. **Korrelation Marktwert ↔ Saisonpunkte = 0.70.** Marktwert sagt VIEL aus.
   → Stars blind meiden ist FALSCH. Reines "billig kaufen" verliert
   (Dogma-Kader 1563 Pkt < Star-Kader 1772 Pkt).

2. **Punkte werden von EINSATZMENGE getrieben (Korr. 0.69), NICHT von der
   Durchschnittsnote (Korr. 0.01).** Das ist der wichtigste Befund.
   Ein Dauerspieler mit Note 3,2 schlägt einen Note-2,2-Spieler mit halber
   Saison. → Suche gesetzte Dauerläufer, nicht "Talente".

3. **Das theoretische Optimum (2882 Pkt) liegt 67% über dem Star-Kader
   (1772).** Diese Lücke schließt KEIN Budget — nur die richtige Auswahl
   billiger Anker.

4. **Effizienz-Anker** (≤2 Mio, ≥120 Pkt): 37 Spieler in 25/26. Muster:
   - Teams mit enger, treuer Rotation liefern Cluster von Ankern
     (TSG Hoffenheim stellte allein 10 Anker!).
   - Defensive Dauerläufer (ABW/MF) systematisch unterbewertet.
   - Beispiele: Diomande (1.6M/273), Coufal (1.8M/238), Batz (0.5M/150),
     Vuskovic (1.6M/213), Kramaric (3.8M/276), Baumgartner (2.3M/256).

5. **Mikromanagement ist der robusteste Hebel.** Im Simulations-Backtest
   (40 Saisons) brachte die wöchentliche Disziplin "nur spielende Spieler
   aufstellen" +18% — unter ALLEN getesteten Weltzuständen positiv, anders
   als der Kader-Trick (situationsabhängig).
   Wird seit 26/27 an echten Spieltagen nachgemessen (`data/messprotokoll.md`).
   Spieltag 1 fiel mit +2 schwach aus — aber konfundiert, weil die News-Arbeit
   dort schon im Kaderbau steckte (Saisonstart). NICHT als Widerlegung lesen,
   bis die Reihe lang genug ist.

## Cross-Season-Validierung (`scripts/cross_season.py`, 4 Saisons)

Die Kernbefunde sind jetzt über 4 Saisons geprüft, nicht mehr nur über eine:
- **Korr(Marktwert, Punkte)**: 0.62 / 0.57 / 0.68 / 0.70 — stabil hoch.
- **Korr(Note, Punkte)**: 0.02 / −0.08 / 0.07 / 0.01 — stabil ~0 in ALLEN
  4 Saisons. Befund 2 ist damit robust bestätigt, nicht Zufall einer Saison.
- **Anker nach Position** (4 Saisons summiert): MF 52, ABW 48, ST 21, TW 8 —
  defensive Dauerläufer-These bestätigt.
- **Anker kommen geclustert, aber das Cluster-Team wechselt jährlich**
  (23/24 VfB ×5, 24/25 1.FC Union ×6, 25/26 TSG ×10). Aus der Vorsaison
  NICHT vorhersagbar, welches Team nächstes Jahr clustert.

### Muster-Analyse Aug 2026 (neu — direkt in die Engine eingeflossen)

1. **Team-Stärke wirkt je Preisklasse GEGENSÄTZLICH** (Teams nach Kader-MV in
   Terzile, Punkte-Mittel relativ zum Schnitt, 4 Saisons):
   | Segment | starkes Team | Mittelfeld | schwaches Team |
   |---|---|---|---|
   | ≤2.5 M | **0.83×** | 1.08× | **1.09×** |
   | 2.5–4 M | 0.94× | 1.00× | 1.06× |
   | >4 M | **1.23×** | 0.77× | — |
   Ursache: billiger Spieler bei Bayern = Ersatzbank; billiger Spieler beim
   Aufsteiger = Stammspieler. In ALLEN 4 Saisons gleichgerichtet.
   → `builder.ts` hat jetzt `TIER_BONUS_BY_SEGMENT` statt eines pauschalen
   Bonus; der alte flache Top-Bonus (+0.05) bestrafte die Anker-Jagd.
2. **Neuzugänge ohne Vorsaison-Eintrag**: 72–85 % kommen überhaupt zum Einsatz,
   Median-Punkte nur ~halb so hoch wie bei Etablierten (16–32 vs. 66–84) —
   ABER die Anker-Quote ist gleich (8–10 %). Korr(MV, Punkte) bei ihnen
   0.56–0.64, fast so gut wie bei Etablierten. Marktwert ist also ein
   valider Schätzer, die Verteilung nur bimodaler.
3. **Kalibrierung des Neuzugangs-Abschlags**: MV-Modell auf Etablierten
   gefittet → Neuzugänge holten **0.84 / 0.72 / 0.81** des Prognosewerts
   (Mittel **0.79**). `EST_DISCOUNT = 0.79`; der Evidenz-Faktor spreizt nur
   noch (0.85 unbestätigt / 1.15 bestätigt), statt ein zweites Mal zu dämpfen.
4. **Anker-Persistenz ist schwach**: von den billigen Ankern einer Saison sind
   im Folgejahr nur **24–54 %** wieder ≥120 Pkt; 18–32 von je ~50 sind zudem
   teurer als 2.5 M geworden. Vorjahres-Anker abschreiben ist keine Strategie.
5. **Aufsteiger-Spieler im billigen Segment liefern leicht ÜBER dem Rest**
   (Ø 55.8 vs. 50.8 Pkt; Anker-Quote 14.0 % vs. 12.2 %, 3 Saisons) — bei
   niedrigerem Marktwert. Aufsteiger pauschal meiden ist falsch.
6. **P/Mio nach Position, stabil über 4 Saisons**: TW 47–58, MF 33–40,
   ABW 30–43, **ST 27–30 (immer Schlusslicht)**. Teure Stürmer sind der
   teuerste Weg zu Punkten (Stürmertor = 3 Pkt vs. ABW 5 / TW 6).

## Die entscheidende methodische Grenze (WICHTIG — nicht ignorieren)

**Auch mit 4 Saisons löst statisches ML den Kaderbau NICHT.** Ehrlicher
Out-of-Sample-Test (Train 22/23→23/24 & 23/24→24/25, blind auf 24/25→25/26):
- Vorsaison-Punkte (Einsatz-Proxy) schlägt Marktwert nur knapp:
  R²=0.37 vs. 0.33; Note nutzlos (R²=0.03); Kombi-Modell R²=0.42.
- **Der Payoff bleibt schwach, wo es zählt:** unter billigen Spielern (≤2,5M)
  trifft das beste Ranking nur **10 von 35** echten Folgesaison-Ankern in den
  Top-30 — kaum besser als Marktwert (9/35). Die entscheidende Variable
  ("wird nächste Saison gesetzt sein?") steht in keiner statischen Tabelle
  (Transfers, Aufsteiger, neue Trainer, Rollenwechsel), nur in den
  Fr/Sa-Aufstellungsnews.
- (Das alte `anchor_model.py` mit R²=0.48 war In-Sample/Selbstbetrug.)

**Konsequenz (unverändert, jetzt belegt):** Setze auf eine REGEL-ENGINE
(Effizienz-Scanner + Spieltags-Optimierer + News), nicht auf ein
Preseason-Orakel. Ein globaler Punkte-Forecast (R²~0.42) taugt als grober
Kader-Sortierer, ersetzt aber nicht die wöchentliche News-Disziplin.

## Auswertungsregel (gilt fuer jeden Spieltag)

**Entscheidungen werden an der Begruendung gemessen, nicht am Ausgang. Ein
einzelner Spieltag ist NIE Evidenz fuer eine Modellaenderung.**

Grund: Die Varianz eines Spieltags ist groesser als der gesamte analytische
Vorsprung. Eine Note spannt 20 Punkte auf (1,0 = +10 bis 6,0 = −10), der
Vorsprung durch die ganze Datenarbeit lag an Spieltag 1 bei 14 Punkten. Ein
einziger Ausrutscher eines bestaetigten Stammspielers loescht ihn aus
(Tapsoba, Note 6,0, −6 statt der ueblichen +8).

Konkret heisst das:
- Eine richtig begruendete Entscheidung, die schiefging, bleibt richtig.
  An Spieltag 1 war der ABGELEHNTE Tausch Tapsoba→Schlotterbeck −6 wert und
  trotzdem korrekt begruendet. Wer solche Faelle als Fehler verbucht, trainiert
  sich das Gegenteil an.
- Nach einem schlechten Spieltag NICHT am Modell drehen. Der Anlass fuehlt
  sich immer gut an und ist fast immer Rauschen.
- Modellaenderungen brauchen eine Serie, nicht ein Ereignis — mit einer
  Ausnahme: harte Regelfunde (z. B. Assist = +2 statt +1) gelten sofort,
  weil sie keine Statistik sind, sondern eine Tatsache.

Die laufende Messreihe steht in `data/messprotokoll.md`; dort sammeln sich
die Zahlen, aus denen spaeter echte Befunde werden duerfen.

## Was gebaut ist (engine/)

| Datei | Zweck | Status |
|---|---|---|
| `scoring.py` | Exakte kicker-Punktelogik (Note→Pkt, Tore, Karten…) | ✓ verifiziert |
| `data_loader.py` | Lädt kicker-CSV, Effizienz-Scanner, Preseason-Heuristik | ✓ läuft |
| `matchday_optimizer.py` | Spieltags-Optimierer (Formation+Startelf nach Status) | ✓ läuft |
| `clubs.py` | Vereins-Namensauflösung kicker ↔ OpenLigaDB (kanon. Codes) | ✓ läuft |
| `openligadb.py` | OpenLigaDB-Client: Spielplan, Anstoßzeiten, Tore | ✓ läuft (live) |
| `squad.py` | Lädt Kader-JSON, leitet erwartete Punkte aus CSV ab | ✓ läuft |
| `status_editor.py` | Interaktive Status-Pflege + Speichern/Laden je Spieltag | ✓ läuft |
| `matchday_cli.py` | **Produktives CLI**: Spielplan+Kader+Status → empfohlene Elf + Timeline | ✓ läuft (live) |
| `watch_scores.py` | **Punkte-Waechter**: pollt die Export-CSV, meldet die Freigabe | ✓ läuft (live) |
| `anchor_model.py` | ML-Anker-Modell (R²=0.48, In-Sample) — Referenz, NICHT produktiv | ✓ (Grenze dokumentiert) |
| `cross_season.py` | 4-Saison-Validierung + ehrlicher N→N+1-Out-of-Sample-Test | ✓ läuft (scripts/) |
| `season.py`, `strategies.py`, `run_backtest.py`, `sensitivity.py` | Simulations-Backtest, der die Strategie über 40 Saisons prüfte | ✓ (im scripts/) |

**Produktiver Aufruf** (Spieltag empfehlen, live von OpenLigaDB):
```
# interaktive Status-Pflege (bequem, empfohlen):
.venv/bin/python engine/matchday_cli.py --squad data/squad.example.json \
    --season 2025 --matchday 1 -i
# oder Status aus JSON:
.venv/bin/python engine/matchday_cli.py --squad data/squad.example.json \
    --season 2025 --matchday 1 --status data/status.example.json
```
Kader: `data/squad.example.json` (22 Spieler, IDs → exp. Punkte aus CSV).
Status: mit `-i` pro Spieler abgefragt (Gegner+Anstoß+exp. Punkte sichtbar),
gespeichert nach `data/status-<saison>-md<NN>.json`, beim nächsten Mal
auto-geladen; neuer Spieltag erbt den Status der Vorwoche als Startpunkt.
Spieler ohne Spiel an dem Spieltag → automatisch `out`.

## Nächste sinnvolle Schritte (Priorität)

1. ~~Spieltags-Optimierer produktiv machen~~ **ERLEDIGT** (`matchday_cli.py`):
   Kader-JSON + OpenLigaDB-Spielplan + News-Status → empfohlene Elf +
   Anstoß-Deadline-Timeline. Läuft live. Der echte 26/27-Kader steht seit
   28.08.2026 in Supabase (22 Spieler, 42,00 Mio), Spieltag 1 ist mit
   Status gepflegt und aufgestellt — siehe `data/spieltage/2026-md01.md`.
   OFFEN: Status-Pflege bequemer machen (bisher pro Spieler ein Klick).

2. **Punkte nach dem Spieltag**: `engine/watch_scores.py` pollt die offene
   Export-CSV und meldet per Push, sobald kicker die Punktespalte befüllt
   (Scheduled Task `kicker-punkte-waechter`, montags 07:04–12:49 alle 15 min).
   Exit 0 = neu da, 20 = schon gemeldet, 10 = leer, 1 = Abruffehler; nur die 0
   benachrichtigt. `--history` zeigt die beobachteten Freigabezeiten — nach ein
   paar Spieltagen lässt sich der Takt darauf verengen. ACHTUNG: kicker setzt
   die Punktespalte zum Saisonstart auf 0 zurück (die Vorsaison-Vorbefüllung
   verschwindet), deshalb ist "Punkte != 0" das Signal.
   NICHT gebaut und bewusst nicht: Umgehung der Sperrfrist über interne
   Endpunkte. Fremdnoten (Bild, Sport1, WhoScored) sind andere Zahlen und
   ersetzen die kicker-Note nicht — das Managerspiel rechnet nur mit ihr.
   OFFEN: Rekonstruktion der Punkte aus OpenLigaDB direkt nach Abpfiff
   (Start/Tore/Karten/Zu-null sind deterministisch, nur Note und Spieler des
   Spiels fehlen). Englische Wochen brauchen einen zweiten Cron-Slot.

3. **Status-Befüllung automatisieren** (halb-automatisch, News bleibt Kai-Job):
   - football-data.org (Free-Key) — echte Aufstellungen/Einwechslungen nach
     Anpfiff (für Rückschau/Kalibrierung von exp_points).
   - Voraussichtliche Elf vor Anpfiff: ligainsider-News (Kai-Tipp) manuell in
     die Status-JSON. Keine kicker+-Paywall scrapen.

4. **Next.js 15 + Supabase + Vercel App** — **SCAFFOLD STEHT** (`web/`):
   - Engine nach TypeScript portiert (`web/src/lib/engine/*`); Optimierer
     liefert identisches Ergebnis wie Python (4-4-2, 78,4 Pkt im Demo-Test).
   - Seiten: `/` Übersicht, `/matchday` (Kernwerkzeug: Status-Buttons + Live-
     OpenLigaDB-Spielplan + empfohlene Elf + Deadline-Timeline), `/squad`
     (**Kader-Editor**: Spielersuche aus echtem 563er-Pool, Budget/Struktur-
     Validierung, Auto-Speichern; Edits fließen live in den Optimierer).
   - Persistenz: LocalStorage default, Supabase optional (`web/supabase/schema.sql`
     mit squad_players+matchday_status, Env-getriggert). Vorwochen-Übertrag wie CLI.
   - Spieler-Pool `web/src/lib/data/players-2025.json` aus CSV generiert (via
     `engine/clubs.py`-canon); neu erzeugen bei neuer Saison.
   - kaivo-Branding: Signal-Magenta #FF006E, Geist, editorial-minimal.
   - `cd web && npm install && npm run dev`. Build grün, Next 15.5 (CVE-gepatcht).
   OFFEN: Vercel-Deploy + Supabase Frankfurt provisionieren, CSV-Import-UI für
   neue Saison, Auth für Mehrbenutzer (statt anon-Policy).

5. ~~Für den Kaderbau 26/27~~ **ERLEDIGT (8. Aug 2026):** `se-k00012026`
   gezogen (549 Spieler, 0 unaufgelöste Vereine), Bridge gelaufen
   (`--preseason --reference 2025`: 361 mit Historie inkl. 7 Rückkehrer über
   die kicker-Vorbefüllung, 188 ohne → Scout/News), Aufsteiger in
   `clubs.py`/`clubs.ts` ergänzt, `players-2026.json` gebündelt,
   `DEFAULT_SEASON=2026`, SEED_SQUAD tolerant gegen Liga-Abgänge.
   OpenLigaDB hat den 26/27-Spielplan (Auftakt 28.08.2026). OFFEN: Kai legt
   `player_pool` per schema.sql im SQL-Editor an (für den /daten-Button;
   die Supabase-MCP hat KEINEN Zugriff auf das kickai-Projekt), dann echten
   26/27-Kader über /aufbau + /squad bauen.

6. ~~Vorsaison→Folgesaison-ML~~ **ERLEDIGT** (`cross_season.py`): 4 Saisons da,
   Test gemacht. Ergebnis: statisches ML hebt den globalen Forecast leicht
   (R²→0.42), löst aber den billigen-Anker-Fund nicht (10/35). Kein weiterer
   ML-Aufwand vor echten Minuten/Stammplatz-Daten sinnvoll.

## Wichtige Constraints

- **Kein Auto-Aufstellen im kicker** (AGB-Verstoß). Das System EMPFIEHLT,
  Kai klickt selbst. Decision-Support, kein Bot.
- **Keine kicker+-Noten scrapen** (Paywall/Lizenz). Die Export-CSV ist
  offen und erlaubt — die nutzen wir.
- Datenschutz/EU: Supabase-Region Frankfurt, wie in Kais anderen Projekten.

## Kcontext zu Kai (für Tonfall/Stack-Entscheidungen)

Stack-Standard: Next.js 15 + Supabase + Vercel + TypeScript, Cloudflare DNS.
Brand: kaivo.studio (Signal-Magenta #FF006E, Geist/Geist Mono). UI:
editorial-minimal, kein Glassmorphism. Die kaivo-brand-Skill liefert Tokens
und Komponenten für alle Dokumente/Deliverables.
