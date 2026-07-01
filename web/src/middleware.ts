// Passwortschutz für die ganze App (HTTP Basic Auth).
// Aktiv nur, wenn APP_PASSWORD gesetzt ist — so bleibt lokale Entwicklung ohne
// Env offen, Production mit gesetztem Passwort geschützt.
// User optional via APP_USER (Default "kai"). Kein NEXT_PUBLIC_ Prefix, damit
// die Werte serverseitig bleiben und nicht im Client-Bundle landen.
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next(); // Schutz deaktiviert

  const user = process.env.APP_USER || "kai";
  const header = req.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(header.slice(6)).split(":");
      if (u === user && p === password) return NextResponse.next();
    } catch {
      // ungültige Kodierung → wie kein Auth behandeln
    }
  }

  return new NextResponse("Authentifizierung erforderlich", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="kick-ai", charset="UTF-8"' },
  });
}

// Alles schützen außer Next-internen Assets und favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
