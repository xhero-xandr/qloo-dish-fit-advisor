"use client";

import { useState } from "react";
import { inputClass } from "./ui";

export function LoginPanel({
  demo,
  onSignedIn,
}: {
  demo?: { username: string; password: string };
  onSignedIn: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function signIn(user: string, pass: string) {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      if (res.ok) {
        onSignedIn();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Sign-in failed.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    signIn(username, password);
  }

  return (
    <section className="no-print w-full rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-lg shadow-accent-900/5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <h2 className="text-lg font-semibold">Sign in to run an analysis</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Each analysis spends shared Qloo and language-model quota, so it sits behind a
        demo account.
      </p>

      {demo && (
        <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => signIn(demo.username, demo.password)}
            className="w-full rounded-xl bg-accent-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-700 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Continue with the demo account"}
          </button>
          <p className="mt-2 text-center text-xs text-zinc-500">
            Demo login: <span className="font-mono">{demo.username}</span> /{" "}
            <span className="font-mono">{demo.password}</span>
          </p>
        </div>
      )}

      {!demo && (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <label className="text-xs font-medium text-zinc-500">
            Username
            <input
              className={`${inputClass} mt-1`}
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="text-xs font-medium text-zinc-500">
            Password
            <input
              className={`${inputClass} mt-1`}
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-accent-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-700 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 text-center text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </section>
  );
}
