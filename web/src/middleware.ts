// Passwortschutz für die ganze App über eine eigene Login-Seite (kaivo-Design).
// Aktiv nur, wenn APP_PASSWORD gesetzt ist. Prüft ein signiertes Cookie;
// fehlt es, wird auf /login umgeleitet (Seiten) bzw. 401 geliefert (API).
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authEnabled, authToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next(); // Schutz deaktiviert

  const { pathname } = req.nextUrl;
  // Login-Seite/-API und die Cron-Endpoints (per CRON_SECRET geschützt) frei.
  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/api/collect-news" ||
    pathname === "/api/keepalive"
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await authToken())) {
    return NextResponse.next();
  }

  // API: sauberer 401 statt Redirect (der App-fetch kennt das Cookie ohnehin).
  if (pathname.startsWith("/api/")) {
    return new NextResponse("Nicht autorisiert", { status: 401 });
  }

  // Seiten: auf Login umleiten, Ziel als ?next merken.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
