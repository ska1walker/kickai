// Login-Route: prüft das Passwort und setzt das Auth-Cookie.
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken, checkPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user, password } = await req.json().catch(() => ({}));
  const ok = await checkPassword(user || "kai", password || "");
  if (!ok) {
    return NextResponse.json({ error: "Falsches Passwort." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 Tage
  });
  return res;
}
