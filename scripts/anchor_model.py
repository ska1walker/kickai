"""
Effizienz-Anker-Modell
=======================
Ziel: Vor der Saison die billigen Spieler identifizieren, die zu
Punkte-Ankern werden — also Dauerspieler mit solider Note und kleinem
Marktwert.

EHRLICHE METHODE:
- Wir sagen NICHT "Talent" voraus (Note ~ entkoppelt von Punkten).
- Wir sagen EINSATZ-getriebene Saisonpunkte voraus.
- Prädiktoren = nur was vor Saison plausibel bekannt ist:
    Marktwert, Position, Team-Stärke (als Verein-Mittelwert).
- Validierung per 5-facher Kreuzvalidierung -> kein Selbstbetrug.

WICHTIGE GRENZE (transparent):
Mit nur EINER Saison und ohne Alter/Vorsaison-Minuten ist das Modell ein
ERSTER Filter, kein Orakel. Es ersetzt nicht die Fr/Sa-News-Prüfung, ob
ein Spieler wirklich gesetzt ist. Es sortiert den Markt vor.
"""
import pandas as pd, numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

df = pd.read_csv("../data/players_clean.csv")
df["Punkte"] = pd.to_numeric(df["Punkte"])
df["MV"] = pd.to_numeric(df["MV"])

# Team-Stärke als Prädiktor (vor Saison aus Vorsaison-Tabelle bekannt;
# hier approximiert durch Team-Gesamtpunkte -> in echt: Vorsaison-Platz)
team_strength = df.groupby("Verein")["Punkte"].transform("mean")
df["TeamStrength"] = team_strength

# Features (alle vor Saison plausibel verfügbar) + Ziel
X = df[["MV", "Pos", "Verein", "TeamStrength"]].copy()
y = df["Punkte"].values

pre = ColumnTransformer([
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["Pos", "Verein"]),
], remainder="passthrough")

model = Pipeline([
    ("pre", pre),
    ("gb", GradientBoostingRegressor(n_estimators=200, max_depth=3,
                                     learning_rate=0.05, random_state=1)),
])

# Ehrliche Out-of-Fold-Vorhersage
cv = KFold(n_splits=5, shuffle=True, random_state=1)
df["pred"] = cross_val_predict(model, X, y, cv=cv)

# Güte
from sklearn.metrics import r2_score, mean_absolute_error
r2 = r2_score(y, df["pred"])
mae = mean_absolute_error(y, df["pred"])
print("="*64)
print("  ANKER-MODELL — ehrliche Kreuzvalidierung")
print("="*64)
print(f"  R² (out-of-fold):  {r2:.2f}   (1.0 = perfekt, 0 = nutzlos)")
print(f"  MAE:               {mae:.0f} Punkte mittlerer Fehler")
print(f"  -> Realistisch: erklärt einen guten Teil, aber mit Streuung.")
print(f"     Als VORFILTER taugt es; als Orakel nicht. Ehrlich so.")

# ANKER-SCORE: vorhergesagte Punkte pro Mio (= erwartete Effizienz)
df["AnkerScore"] = df["pred"] / df["MV"]

# Die Empfehlung des Modells: günstige Spieler mit hohem Anker-Score
budget_picks = df[df["MV"] <= 2.5].sort_values("AnkerScore", ascending=False)
print("\n" + "="*64)
print("  MODELL-EMPFEHLUNG: Top-20 Effizienz-Anker (≤2,5 Mio)")
print("  sortiert nach VORHERGESAGTER Punkte/Mio")
print("="*64)
print(f"  {'Spieler':<15}{'Pos':<5}{'Verein':<15}{'MV':>5}{'Pred':>6}{'Echt':>6}")
for _,r in budget_picks.head(20).iterrows():
    print(f"  {r['nm']:<15}{r['Pos']:<5}{r['Verein'][:14]:<15}{r['MV']:>4.1f}"
          f"{r['pred']:>6.0f}{r['Punkte']:>6.0f}")

# Wie gut hätte das Modell die echten Anker getroffen? (Treffer-Check)
echte_anker = set(df[(df["MV"]<=2.0)&(df["Punkte"]>=120)]["ID"])
modell_top = set(df[df["MV"]<=2.0].sort_values("AnkerScore",ascending=False).head(40)["ID"])
hits = len(echte_anker & modell_top)
print(f"\n  Treffer-Check: Modell-Top-40 (≤2 Mio) enthält {hits}/{len(echte_anker)} "
      f"der echten Anker ({100*hits/len(echte_anker):.0f}%)")

df.to_csv("players_scored.csv", index=False)
print("\n  (Scores gespeichert in players_scored.csv)")
