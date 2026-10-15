"use client";

import { useState } from "react";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
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

  const input =
    "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-orange-900";

  return (
    <section className="no-print max-w-md rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-lg shadow-orange-900/5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <h2 className="text-lg font-semibold">Sign in to run an analysis</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Each analysis spends shared Qloo and Gemini quota, so it sits behind a demo account.
      </p>

      {demo && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200">
          <p className="font-medium">Demo account</p>
          <p className="mt-1 font-mono text-xs">
            username: {demo.username}
            <br />
            password: {demo.password}
          </p>
          <button
            type="button"
            onClick={() => {
              setUsername(demo.username);
              setPassword(demo.password);
            }}
            className="mt-2 text-xs font-medium underline underline-offset-2"
          >
            Fill in the demo account
          </button>
        </div>
      )}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="text-xs font-medium text-zinc-500">
          Username
          <input
            className={`${input} mt-1`}
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Password
          <input
            className={`${input} mt-1`}
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
