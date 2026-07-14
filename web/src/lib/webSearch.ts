// Self-Healing für web_search-Whitelists: Wenn die Anthropic-API eine Domain
// ablehnt ("domains are not accessible to our user agent"), wird sie aus der
// Whitelist entfernt und der Aufruf einmal wiederholt. So kann eine einzelne
// blockende Quelle (wie transfermarkt.de) nie mehr den ganzen Lauf zerschießen —
// und wir können die Quellenliste gefahrlos breit halten.

/** Entfernt von der API gemeldete blockierte Domains in-place aus dem
 *  web_search-Tool. true = es wurde gekürzt und ein Retry lohnt sich. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pruneBlockedDomains(tools: any[], err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? "";
  const m = msg.match(/domains are not accessible[^:[]*:?\s*\[([^\]]*)\]/i);
  if (!m) return false;
  const bad = m[1]
    .split(",")
    .map((s) => s.replace(/['"\s]/g, ""))
    .filter(Boolean);
  if (!bad.length) return false;
  const ws = tools.find((t) => t?.name === "web_search");
  if (!ws?.allowed_domains?.length) return false;
  const before: number = ws.allowed_domains.length;
  ws.allowed_domains = ws.allowed_domains.filter((d: string) => !bad.includes(d));
  // Nur retryen, wenn wirklich gekürzt wurde und noch Quellen übrig sind.
  return ws.allowed_domains.length > 0 && ws.allowed_domains.length < before;
}
