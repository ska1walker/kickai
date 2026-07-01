# kick-ai web — Decision-Support App

Next.js 15 (App Router) + TypeScript + Tailwind + Supabase, kaivo-Branding.
Portiert die Python-Engine (`../engine`) nach TypeScript und macht den
Spieltags-Optimierer zur klickbaren UI.

## Schnellstart

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Läuft **ohne Setup**: Spielplan kommt live von OpenLigaDB, Status wird im
Browser (LocalStorage) gespeichert. Supabase ist optional (s.u.).

## Seiten

- `/` — Übersicht (Kernbefunde, Einstiege)
- `/matchday` — **Kernwerkzeug**: Spieltag wählen → Status pro Spieler pflegen
  (S/D/B/O) → empfohlene Elf + erwartete Punkte + Anstoß-Deadline-Timeline.
  Spieler ohne Spiel werden automatisch `out`. Status überträgt sich auf den
  nächsten Spieltag als Startpunkt.
- `/squad` — **Kader-Editor**: Spieler aus dem echten 25/26-Pool (563 Spieler)
  per Suche hinzufügen/entfernen, Verein/Position/MV/exp. Punkte auto-gefüllt.
  Live-Validierung von Budget (42,5 Mio) und Struktur (3-7-7-5). Auto-Speichern.
  **Talent-Scout**: KI recherchiert pro Spieler Signale jenseits des Marktwerts —
  Vorbereitungsform, U21-/A-Nominierung, Fritz-Walter-Medaille, erwartete Rolle —
  und zeigt ein Durchbruch-/Stammplatz-Signal als Marker (`src/app/api/scout`,
  web_search, Whitelist `dfb.de, transfermarkt.de, kicker.de, ligainsider.de,
  fussballdaten.de`, per `SCOUT_ALLOWED_DOMAINS` überschreibbar).
- `/aufbau` — **Kader-Vorschlag**: baut automatisch aus den Saisondaten einen
  budget-/strukturkonformen Kader (`src/lib/engine/builder.ts`, deterministisch,
  Effizienz-Anker-Score). Optimiert die **beste aufstellbare Elf** (Budget auf
  ~14 Starter konzentriert, 8 billige Bank; Kennzahl „Erwartete Startelf") und
  gewichtet die **Einsatzsicherheit** (`src/lib/engine/security.ts`: Dominanz auf
  dem Positions-Slot des Klubs; Chip „Stammplatz hoch/mittel/rotation").
  Pro Slot Top-Empfehlung + 2 Alternativen mit Begründungs-Tooltip, per „wählen"
  tauschbar, „übernehmen" lädt in den Editor.
  **Ceiling-Plays** (`src/lib/engine/strategy.ts`): Abwehr-Stacking (TW+ABW des
  stärksten Defensivteams für korrelierte Zu-Null, per Toggle), Anker-Cluster
  (Vereine mit vielen billigen Stammspielern höher gewichtet, auto) und
  Standard-/Elfmeterschützen (`src/app/api/set-pieces`, web_search; ABW-Tor=+5).
  Optional fließt eine **Team-Tier-Analyse** ein (`src/app/api/team-tiers`,
  web_search): erwartete Spitzen-/Überraschungs-/Mittel-/Abstiegsteams — günstige
  Spieler erwarteter Überraschungsteams werden höher gewichtet.
- `/news` — **News-Memory**: täglich gesammelte Transfer-/Kader-News aus
  Supabase (`news_log`), mit Aktualitäts-Gewicht (dauerhafte Fakten = 100%,
  flüchtige Signale mit Halbwertszeit fallend).
- `/anleitung` — Schritt-für-Schritt-Ablauf (Kader → Spieltag).

## News-Sammler (täglicher Cron)

`vercel.json` definiert einen täglichen Cron (06:00) auf `/api/collect-news`.
Die Route lässt Claude per web_search die wichtigsten BL-News der letzten ~48h
sammeln (Transfers, Trainer, Rückkehrer, Verletzungen/Sperren, Vorbereitung) und
schreibt strukturierte Einträge (`type`, `durable`, `summary`, `source`) in
`news_log` (upsert per `dedup_key`, gruppiert dieselbe Story über Tage).
Geschützt per `CRON_SECRET` (Vercel sendet ihn als Bearer automatisch; ohne
Secret ist der Endpoint deaktiviert). Aktivieren:
1. `news_log`-Teil aus `supabase/schema.sql` im SQL-Editor ausführen.
2. `CRON_SECRET` (beliebiger String) in Vercel-Env setzen; Cron aktiviert sich
   mit dem nächsten Deploy. Manuell testen:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/collect-news`.
Gewichtung/Weiterverwendung: `src/lib/news.ts` (`recencyWeight`),
`src/lib/newsSignals.ts` (Aufbereitung zu Spieler-/Vereins-Signalen).

**Einfluss auf den Kader-Vorschlag:** `/aufbau` lädt die News-Memory und lässt sie
in `buildProposal` einfließen — Ab-/Zugänge, Verletzungen/Sperren, Rückkehr,
Vorbereitungsform (Spielerebene) sowie Netto-Transferstärke (Vereinsebene),
recency-gewichtet. Ein Abgang wertet den Spieler stark ab, ein starker
Transfersommer hebt die günstigen Spieler des Vereins. Erscheint als „News:"-Notiz
in der Begründung und als Zähler „N News-Signale einbezogen".

## KI-Statusvorschlag mit eigener News-Recherche (optional)

Auf `/matchday` durchsucht ein KI-Assistent per Claude **Web-Search-Tool** selbst
die aktuellen voraussichtlichen Aufstellungen und Verletzungsnews (kicker,
ligainsider, transfermarkt …) zu den Spielen des Kaders und schlägt pro Spieler
start/doubt/bench/out vor (`src/app/api/suggest-status`, server-seitig via
`@anthropic-ai/sdk`, `web_search`-Tool + strukturierter `report_status`-Tool-Output).
Kein Einfügen nötig; optional kann eigener News-Text als Zusatzkontext ergänzt
werden. Nur Vorschlag — Kai bestätigt (Decision-Support, kein Bot).

Die Suche ist **hart auf eine Quellen-Whitelist** beschränkt (`allowed_domains`):
Standard `kicker.de, ligainsider.de, transfermarkt.de, sport1.de, bundesliga.com,
fussballdaten.de`, per `NEWS_ALLOWED_DOMAINS` (kommagetrennt) überschreibbar. Die
Anfrage gruppiert den Kader nach Verein → eine Suche pro Verein, nur die
Kaderspieler zählen.

Aktiv nur mit gesetztem `ANTHROPIC_API_KEY`; ohne Key liefert die Route 501 und der
Button bleibt wirkungslos. Modell per `ANTHROPIC_MODEL` überschreibbar (Default
`claude-opus-4-8`; die Tool-Version wählt automatisch Dynamic Filtering auf
Opus-4.x/Sonnet-4.6, sonst die Basis-Variante). `maxDuration=120` für die
Web-Recherche. Web-Search verursacht geringe Zusatzkosten pro Suche.

## Architektur

```
src/lib/engine/       TS-Port der Python-Engine (types, clubs, openligadb, optimizer, constraints)
src/lib/data/         Spieler-Pool (players-2025.json, aus CSV generiert) + Seed-Kader + pool.ts (Suche)
src/lib/store.ts      Status-Persistenz (Supabase | LocalStorage)
src/lib/squadStore.ts Kader-Persistenz (Supabase | LocalStorage), Fallback Seed
src/app/api/matchday  Server-Route: OpenLigaDB-Abruf (kein CORS im Client)
supabase/schema.sql   DB-Schema (squad_players, matchday_status)
```

Pool neu erzeugen: `python engine/build_pool.py --season <jahr>` schreibt
`src/lib/data/players-<jahr>.json`. Für eine noch ungespielte Saison (Punkte=0)
die **Vorsaison-Punkte-Bridge**: `--season 2026 --reference 2025 --preseason` —
hängt Vorsaisonpunkte per Spieler-ID an; Neue ohne Historie bekommen
`hasHistory:false` (Einschätzung dann via Scout/News). Spielernoten werden
bewusst nicht verwendet (Korr(Note,Punkte)≈0). Danach den Import in `pool.ts` und
`DEFAULT_SEASON` in `squad.ts` auf die neue Saison zeigen lassen.

Der Optimierer im Client ist deckungsgleich mit `engine/matchday_optimizer.py`
(gleiche Formationen, Status-Gewichte, Ergebnis: identische Elf & Punkte).

## Supabase aktivieren (optional, Region EU Frankfurt)

1. Projekt in Region **Frankfurt** anlegen.
2. `supabase/schema.sql` im SQL-Editor ausführen. Optional danach
   `supabase/seed.sql` für den Default-Kader (sonst fällt die App auf den
   eingebauten Seed zurück).
3. `.env.local` anlegen (Vorlage: `.env.local.example`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. Neu starten → Status wird jetzt in Supabase persistiert statt im Browser.

## Deploy (Vercel, Auto-Deploy via GitHub)

Das Repo ist mit Vercel verbunden — jeder Push auf `main` deployt automatisch.
**Kritisch:** Die Next-App liegt im Unterordner `web/`, nicht im Repo-Root. In
den Vercel-Projekt-Einstellungen deshalb setzen:

1. **Root Directory = `web`** (Settings → General → Root Directory).
   Ohne das schlägt der Build fehl (Root hat kein `package.json`).
2. **Environment Variables** (Settings → Environment Variables), für alle
   Environments (Production/Preview):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://llagnybrzybbkeidqtzc.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-Key aus Supabase → Settings → API>
   APP_USER=kai                # optional, Default "kai"
   APP_PASSWORD=<dein Passwort> # aktiviert den Passwortschutz (Basic Auth)
   ANTHROPIC_API_KEY=<key>      # optional, aktiviert den KI-Statusvorschlag
   ANTHROPIC_MODEL=             # optional, Default claude-opus-4-8
   ```
   (`.env.local` ist gitignored und landet NICHT bei Vercel — daher hier setzen.)

## Passwortschutz

Eigene Login-Seite (`/login`, kaivo-Design) statt Browser-Dialog. `middleware.ts`
prüft ein httpOnly-Cookie (SHA-256-Token, kein Klartext-Passwort) und leitet
sonst auf `/login` um; die API antwortet mit 401. `api/login` verifiziert das
Passwort und setzt das Cookie (30 Tage). Aktiv nur, wenn `APP_PASSWORD` gesetzt
ist — sonst offen (praktisch lokal). User via `APP_USER` (Default `kai`).
3. Framework wird als **Next.js** auto-erkannt, Build `next build`. Fertig.

Cloudflare-DNS wie in den anderen kaivo-Projekten.

## Nächste Ausbaustufen

- CSV-Import (neue Saison 26/27) → `squad_players` + exp. Punkte neu berechnen.
- Auth (Supabase) für Mehrbenutzer statt anon-Policy.
- Saison-/Spieltag-Auswahl in der UI (aktuell Saison fix 2025).
