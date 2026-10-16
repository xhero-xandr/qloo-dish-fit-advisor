"use client";

import { useCallback, useEffect, useState } from "react";

export interface DemoHint {
  username: string;
  password: string;
}

interface SessionData {
  authRequired?: boolean;
  authenticated?: boolean;
  demo?: DemoHint;
}

/** Whether the visitor may run analyses. "ok" also covers a server with no login configured. */
export function useSession() {
  const [auth, setAuth] = useState<"checking" | "required" | "ok">("checking");
  const [authRequired, setAuthRequired] = useState(false);
  const [demo, setDemo] = useState<DemoHint>();

  const apply = useCallback((data: SessionData) => {
    setAuthRequired(Boolean(data.authRequired));
    setDemo(data.demo);
    setAuth(data.authenticated ? "ok" : "required");
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      apply(await res.json());
    } catch {
      setAuth("ok"); // if the check itself fails, let the analysis request report the problem
    }
  }, [apply]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => !cancelled && apply(data))
      .catch(() => !cancelled && setAuth("ok"));
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const signOut = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" });
    await refresh();
  }, [refresh]);

  return { auth, authRequired, demo, refresh, signOut };
}
