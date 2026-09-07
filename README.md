# kicker Interactive — Gewinn-System

KI-gestütztes Decision-Support-System für das **kicker-Managerspiel
Interactive (Bundesliga)**. Ziel: eine private Liga gewinnen.

> **Lies zuerst `CLAUDE.md`** — dort steht der vollständige Projektkontext,
> alle Befunde aus echten Daten und die nächsten Schritte.

## Kernidee in einem Satz

Das Spiel gewinnt man über **Einsatz-Disziplin** (jeden Spieltag nur Spieler
aufstellen, die wirklich spielen) und **Effizienz-Anker** (billige
Dauerläufer statt teurer Stars) — nicht über das Lesen von Marktwerten.

## Schnellstart

```bash
pip install -r requirements.txt

# 1. PRODUKTIV: Spieltag empfehlen (live von OpenLigaDB)
#    -i = Status pro Spieler interaktiv pflegen (bequem, wird gespeichert)
python engine/matchday_cli.py --squad data/squad.example.json \
    --season 2025 --matchday 1 -i

# 2. Effizienz-Scanner auf den Datensatz
python engine/data_loader.py

# 3. Cross-Season-Analyse (4 Saisons: Muster-Stabilität + ehrliches ML)
python scripts/cross_season.py

# 4. Scoring-Engine Selbsttest
python engine/scoring.py

# 5. Simulations-Backtest (Strategie-Beweis über 40 Saisons)
python scripts/run_backtest.py
python scripts/sensitivity.py
```

> Hinweis: `se-k0001<Jahr>` = Saison-Startjahr, `se-k00012025` = **2025/26**
> (aktuellste komplette Saison, liegt in `data/`). Details in CLAUDE.md.

## Struktur

```
engine/                 Produktive Module
  scoring.py            Exakte kicker-Punktelogik
  data_loader.py        CSV-Loader + Effizienz-Scanner + Preseason-Heuristik
  matchday_optimizer.py Spieltags-Optimierer (Formation + Startelf)
  clubs.py              Vereins-Namensauflösung kicker ↔ OpenLigaDB
  openligadb.py         OpenLigaDB-Client (Spielplan, Anstoß, Tore)
  squad.py              Kader-JSON laden + erwartete Punkte aus CSV
  status_editor.py      Interaktive Status-Pflege + Speichern je Spieltag
  matchday_cli.py       abgeloest von der Web-App (/matchday); nutzt den Beispielkader
  anchor_model.py       ML-Anker-Modell (Referenz; Grenzen in CLAUDE.md)

scripts/                Backtest & Analyse
  cross_season.py       4-Saison-Validierung + ehrliches N→N+1-ML
  season.py, strategies.py, run_backtest.py, sensitivity.py

data/                   Datensätze
  players-se-k0001{2022..2025}.csv  kicker-Export 22/23 … 25/26
  squad.example.json                Beispiel-Kader (22 Spieler)
  status.example.json               Beispiel-Status pro Spieltag

docs/                   (für kaivo-Dokumente, Ergebnisberichte)
```

## Neuen Datensatz einspielen (Saison 26/27)

`se-k0001<Jahr>` = Saison-Startjahr; die 4 vorhandenen Saisons (22/23–25/26)
liegen bereits in `data/`. Sobald 26/27 gespielt wird:
1. Export-URL aufrufen (mit `www.`!):
   `https://www.kicker-libero.de/api/sportsdata/v1/players-details/se-k00012026.csv`
   (aktuell noch 404 — Saison startet Aug 2026.)
2. CSV nach `data/` legen.
3. `python scripts/cross_season.py` (Saison ergänzen) + `data_loader.py`
   → Anker-Kandidaten, Marktwert-Fallen, Modell-Update.

## Wichtig

- **Kein Auto-Aufstellen** im kicker (AGB). Das System empfiehlt, du klickst.
- **Keine kicker+-Noten scrapen.** Nur die offene Export-CSV nutzen.
