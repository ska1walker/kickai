# Spieltag 6 — Saison 2026/27 (Rechnung mit lineup.ts)

Wissensstand VOR Anpfiff, Fr 16.10.2026 ~08:20. Nicht nachtraeglich editieren.
Von Hand nach `scripts/lineup_routine.md` gerechnet, weil der Routine-Lauf am
fehlenden Supabase-Schluessel scheiterte (Secret greift nicht; anon-Key aus
`.github/workflows/supabase-keepalive.yml` verwendet). Quellen: ligainsider.py
und comunio.py (Artikel vom 15.10.). Status in Supabase geschrieben.

**Ersetzt die Handnotiz `2026-md06.md`.** Die Rechnung ist besser als die
Handempfehlung von 08:00: Kramaric fest rein, Wackelplatz ist da Costa vs.
ter Horst — beide Sa 15:30, also mit voller Information um 14:30 entscheidbar.
Rechnung: da Costa startet → 2,8 + 4,7 (statt 2,2 + 4,7 in der Handvariante);
startet er nicht → in beiden Varianten 5,0. Nie schlechter, oft besser.

## Status je Spieler mit Quelle

- start (beide Quellen in der Elf): Nicolas, Coufal, Raum, Tapsoba, ter Horst,
  Aleix Garcia, Rieder, S. El Mala, R. Khedira
- doubt: Lemperle (ligainsider drin, Comunio "Lemperle (Hlozek)" = umkaempft),
  da Costa (ligainsider drin, Comunio "Potulski (da Costa)" = Alternative),
  Kramaric (ligainsider nicht drin, Comunio "als Option", Rotation nach EL)
- bench: Schmetgens, Lemke, Tarnutzer, Schnitzer, Millgramm, Klaus, Ulreich
- out: Rondic (Comunio: fehlt), Damjanovic, Kastanaras (Liga verlassen)


## Empfehlung Spieltag 6: 4-5-1 — 51,4 Punkte erwartet

| Pos | Spieler | Verein | Spiel | Anstoss | Status | Vorsaison/Sp | Saison (Pkt in Sp) | erwartet | Kontext | Wert |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|
| TW | Nicolas | Bor. Mönchengladbach | vs TSG Hoffenheim | So 17:30 | start | 7,2 | 16 in 5 | 5,2 | -0,2 | 5,0 |
| ABW | Coufal | TSG Hoffenheim | @ Bor. Mönchengladbach | So 17:30 | start | 7,0 | 28 in 5 | 6,3 | +0,2 | 6,5 |
| ABW | Tapsoba | Bayer 04 Leverkusen | vs SC Freiburg | So 15:30 | start | 5,9 | 22 in 5 | 5,2 | +0,6 | 5,7 |
| ABW | Raum | RB Leipzig | @ Bayern München | Sa 18:30 | start | 6,1 | 26 in 5 | 5,7 | -1,0 | 4,6 |
| ABW | da Costa | 1. FSV Mainz 05 | @ FC Schalke 04 | Sa 15:30 | doubt | 4,0 | 25 in 5 | 4,5 | +0,2 | 2,6 |
| MF | Rieder | FC Augsburg | @ SV Elversberg | Sa 15:30 | start | 4,6 | 48 in 5 | 7,1 | -0,1 | 6,9 |
| MF | Aleix Garcia | Bayer 04 Leverkusen | vs SC Freiburg | So 15:30 | start | 6,6 | 30 in 5 | 6,3 | +0,6 | 6,8 |
| MF | S. El Mala | 1. FC Köln | @ Eintracht Frankfurt | Fr 20:30 | start | 6,5 | 26 in 5 | 5,9 | -0,4 | 5,5 |
| MF | Kramaric | TSG Hoffenheim | @ Bor. Mönchengladbach | So 17:30 | doubt | 8,1 | 8 in 5 | 4,9 | +0,2 | 2,8 |
| MF | R. Khedira | 1. FC Union Berlin | vs Borussia Dortmund | Sa 15:30 | start | 4,7 | 4 in 5 | 2,8 | -0,4 | 2,3 |
| ST | Lemperle | TSG Hoffenheim | @ Bor. Mönchengladbach | So 17:30 | doubt | 4,7 | 23 in 5 | 4,7 | +0,2 | 2,7 |

### Bank

| Pos | Spieler | Verein | Spiel | Anstoss | Status | Vorsaison/Sp | Saison (Pkt in Sp) | erwartet | Kontext | Wert |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|
| TW | Klaus | 1. FC Union Berlin | vs Borussia Dortmund | Sa 15:30 | bench | 1,0 | 0 in 5 | 0,5 | -0,4 | 0,0 |
| TW | Ulreich | Bayern München | vs RB Leipzig | Sa 18:30 | bench | 0,4 | 0 in 5 | 0,2 | +1,0 | 0,3 |
| ABW | ter Horst | SC Paderborn 07 | @ Werder Bremen | Sa 15:30 | start | 0,8 | 18 in 5 | 2,8 | -0,6 | 2,2 |
| ABW | Schmetgens | Werder Bremen | vs SC Paderborn 07 | Sa 15:30 | bench | 0,1 | 10 in 5 | 1,1 | +0,6 | 0,3 |
| ABW | Lemke | Hamburger SV | vs VfB Stuttgart | Sa 15:30 | bench | 0,1 | 10 in 5 | 1,0 | -0,7 | 0,1 |
| MF | Tarnutzer | SC Freiburg | @ Bayer 04 Leverkusen | So 15:30 | bench | 0,1 | 0 in 5 | 0,0 | -0,6 | -0,1 |
| MF | Schnitzer | FC Augsburg | @ SV Elversberg | Sa 15:30 | bench | 0,1 | 0 in 5 | 0,0 | -0,1 | -0,0 |
| ST | Rondic | 1. FC Köln | @ Eintracht Frankfurt | Fr 20:30 | out | 0,0 | 4 in 5 | 0,4 | -0,4 | 0,0 |
| ST | A. Millgramm | SC Paderborn 07 | @ Werder Bremen | Sa 15:30 | bench | 0,0 | 0 in 5 | 0,0 | -0,6 | -0,1 |
| ST | Damjanovic | Bayer 04 Leverkusen | vs SC Freiburg | So 15:30 | out | 0,0 | 0 in 5 | 0,0 | +0,6 | 0,0 |
| ST | Kastanaras | FC Augsburg | @ SV Elversberg | Sa 15:30 | out | 0,0 | – | 0,0 | -0,1 | 0,0 |

### Ersatz, falls kurzfristig raus (nur spaetere Anstoesse)

- Nicolas (So 17:30): **kein Ersatz mehr**
- Coufal (So 17:30): **kein Ersatz mehr**
- Tapsoba (So 15:30): **kein Ersatz mehr**
- Raum (Sa 18:30): **kein Ersatz mehr**
- da Costa (Sa 15:30): **kein Ersatz mehr**
- Rieder (Sa 15:30): Tarnutzer
- Aleix Garcia (So 15:30): **kein Ersatz mehr**
- S. El Mala (Fr 20:30): Schnitzer, Tarnutzer
- Kramaric (So 17:30): **kein Ersatz mehr**
- R. Khedira (Sa 15:30): Tarnutzer
- Lemperle (So 17:30): **kein Ersatz mehr**

### Hinweise

- Ohne Ersatz, falls kurzfristig raus: Nicolas, Coufal, Tapsoba, Raum, da Costa, Aleix Garcia, Kramaric, Lemperle — kein Spieler derselben Position stoesst spaeter an.
- 3 fragliche Spieler in der Startelf (da Costa, Kramaric, Lemperle) — vor Anpfiff News prüfen.
- Nur 0 sicherer ST-Spieler — Engpass-Risiko.

_Wert = (erwartet + Kontext) × Statusgewicht (start 1 / doubt 0,55 / bench 0,2). Erwartet = (Vorsaison × k + Saisonpunkte) / (k + Spiele), k = 5 (2 bei geschaetzter Vorsaison). Kontext = Heimrecht ±0,25 + Gegnerstaerke._

## Entscheidungspunkte

1. **Fr ~19:30 (Frankfurt–Koeln):** El Mala in beiden Prognosen. Fehlt er →
   ter Horst rein (5-4-1); Schnitzer/Tarnutzer haben keine Startelf-Chance.
2. **Sa ~14:30 (15:30-Spiele):** Steht da Costa in der Mainzer Startelf →
   so lassen. Steht er NICHT drin → **da Costa raus, ter Horst rein** (gleiche
   Anstosszeit, Formation bleibt 4-5-1). Fehlt Rieder oder Khedira →
   ter Horst rein und 5-4-1.
3. **So ~16:30 (Gladbach–Hoffenheim):** Kramaric, Lemperle, Coufal, Nicolas
   spielen zuletzt — fuer sie gibt es keinen Ersatz mehr. Kramaric muss schon
   vor Sa 15:30 feststehen, weil sein einziger sinnvoller Tausch (ter Horst)
   dann gesperrt ist.

## Nach dem Spieltag pruefen

- Kramaric (doubt, fest in der Elf): Startelf oder Joker nach Europa League?
- da Costa: verdraengt er Potulski wirklich?
- Der Optimierer stellt einen sicheren Starter (ter Horst, 2,2) hinter einen
  fraglichen (da Costa, 2,6) — Anlass, das Statusgewicht doubt = 0,55 ueber
  mehrere Spieltage gegenzupruefen, NICHT jetzt zu aendern.
