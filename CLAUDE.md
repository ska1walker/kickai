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
  Tore (TW 6 / ABW 5 / MF 4 / ST 3), Assist +1, Zu-null-TW +2,
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
`se-k00012022`=22/23, `2023`=23/24, `2024`=24/25, `2025`=25/26.
`se-k00012026` = 26/27 → 404 (noch nicht gespielt, startet Aug 2026). Damit ist
25/26 die **aktuellste komplette Saison und liegt bereits in `data/`** — nichts
Neueres zu holen bis 26/27 durch ist. ACHTUNG Sentinel: MV=999 Mio = „kein
Marktwert gelistet" (v.a. 24/25-Datei) → filtern.

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
   Anstoß-Deadline-Timeline. Läuft live. OFFEN: echten Kai-Kader statt
   Beispiel eintragen (sobald 26/27-Kader steht), Status-Pflege bequemer machen.

2. **Status-Befüllung automatisieren** (halb-automatisch, News bleibt Kai-Job):
   - football-data.org (Free-Key) — echte Aufstellungen/Einwechslungen nach
     Anpfiff (für Rückschau/Kalibrierung von exp_points).
   - Voraussichtliche Elf vor Anpfiff: ligainsider-News (Kai-Tipp) manuell in
     die Status-JSON. Keine kicker+-Paywall scrapen.

3. **Next.js 15 + Supabase + Vercel App** — **SCAFFOLD STEHT** (`web/`):
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

4. **Für den Kaderbau 26/27:** sobald `se-k00012026` (26/27) verfügbar wird
   (nach Saisonstart Aug 2026, aktuell 404), ziehen und Scanner/cross_season
   erweitern. Bis dahin ist 25/26 (`se-k00012025`) die aktuellste Basis —
   liegt schon in `data/`.

5. ~~Vorsaison→Folgesaison-ML~~ **ERLEDIGT** (`cross_season.py`): 4 Saisons da,
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
