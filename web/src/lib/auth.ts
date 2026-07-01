// Geteilte Auth-Helfer für Middleware (Edge) und Login-Route (Node).
// Cookie speichert NICHT das Passwort, sondern einen SHA-256-Token daraus.
export const AUTH_COOKIE = "kickai_auth";

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

/** Token = SHA-256(hex) von "passwort|user". Identisch in Middleware & Route. */
export async function authToken(): Promise<string> {
  const secret = `${process.env.APP_PASSWORD ?? ""}|${process.env.APP_USER ?? "kai"}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function checkPassword(user: string, password: string): Promise<boolean> {
  return user === (process.env.APP_USER ?? "kai") && password === process.env.APP_PASSWORD;
}
