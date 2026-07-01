"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: "kai", password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Anmeldung fehlgeschlagen.");
        setLoading(false);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next.startsWith("/") ? next : "/";
    } catch {
      setError("Netzwerkfehler.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold tracking-tight">kick-ai</span>
          <span className="h-2 w-2 rounded-full bg-signal" />
        </div>
        <div className="card p-6">
          <p className="label-caps">Zugang</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Anmelden</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Diese App ist privat. Bitte Passwort eingeben.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              className="w-full rounded-md border border-ink-line px-3 py-2 text-sm outline-none focus:border-signal"
            />
            {error && <p className="text-sm text-signal-700">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="btn-signal w-full disabled:opacity-50"
            >
              {loading ? "Prüfe…" : "Anmelden"}
            </button>
          </form>
        </div>
        <p className="label-caps mt-4 text-center">kaivo.studio</p>
      </div>
    </div>
  );
}
