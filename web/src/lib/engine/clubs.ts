// Vereins-Namensauflösung kicker ↔ OpenLigaDB (Port aus engine/clubs.py).

const CLUBS: Record<string, string[]> = {
  bayern: ["Bayern München", "FC Bayern München"],
  dortmund: ["Borussia Dortmund"],
  leverkusen: ["Bayer 04 Leverkusen"],
  gladbach: ["Bor. Mönchengladbach", "Borussia Mönchengladbach"],
  frankfurt: ["Eintracht Frankfurt"],
  leipzig: ["RB Leipzig"],
  union: ["1. FC Union Berlin"],
  freiburg: ["SC Freiburg"],
  hoffenheim: ["TSG Hoffenheim", "TSG 1899 Hoffenheim"],
  stuttgart: ["VfB Stuttgart"],
  wolfsburg: ["VfL Wolfsburg"],
  bochum: ["VfL Bochum"],
  mainz: ["1. FSV Mainz 05", "Mainz 05"],
  augsburg: ["FC Augsburg"],
  bremen: ["Werder Bremen", "SV Werder Bremen"],
  koeln: ["1. FC Köln"],
  heidenheim: ["1. FC Heidenheim", "1. FC Heidenheim 1846"],
  stpauli: ["FC St. Pauli"],
  kiel: ["Holstein Kiel"],
  hsv: ["Hamburger SV"],
  hertha: ["Hertha BSC"],
  schalke: ["FC Schalke 04"],
  darmstadt: ["SV Darmstadt 98"],
};

// Anzeigenamen je Code (für die UI).
export const CLUB_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(CLUBS).map(([code, names]) => [code, names[0]]),
);

function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ALIAS: Record<string, string> = {};
for (const [code, names] of Object.entries(CLUBS)) {
  for (const n of names) ALIAS[norm(n)] = code;
  ALIAS[norm(code)] = code;
}

export function canon(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = norm(name);
  if (ALIAS[n]) return ALIAS[n];
  for (const [aliasNorm, code] of Object.entries(ALIAS)) {
    if (aliasNorm && (n.includes(aliasNorm) || aliasNorm.includes(n))) return code;
  }
  return null;
}
