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

## Architektur

```
src/lib/engine/       TS-Port der Python-Engine (types, clubs, openligadb, optimizer, constraints)
src/lib/data/         Spieler-Pool (players-2025.json, aus CSV generiert) + Seed-Kader + pool.ts (Suche)
src/lib/store.ts      Status-Persistenz (Supabase | LocalStorage)
src/lib/squadStore.ts Kader-Persistenz (Supabase | LocalStorage), Fallback Seed
src/app/api/matchday  Server-Route: OpenLigaDB-Abruf (kein CORS im Client)
supabase/schema.sql   DB-Schema (squad_players, matchday_status)
```

Pool neu erzeugen (nach neuer CSV): `../engine`-Snippet in der Projekt-Doku,
schreibt `src/lib/data/players-2025.json` mit id/name/club/pos/mv/points/expPoints.

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
