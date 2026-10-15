// A light demo login: one shared account from the environment, a signed session cookie, and
// per-client rate limits. It keeps drive-by traffic off the shared Qloo and Gemini quotas;
// it is not user management. Auth is off unless DEMO_PASSWORD is set.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "dfa_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const DEMO_USER = process.env.DEMO_USER || process.env.DEMO_USERNAME || "demo";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";
const SECRET = process.env.SESSION_SECRET || DEMO_PASSWORD;

export function isAuthEnabled(): boolean {
  return DEMO_PASSWORD !== "";
}

/** The demo account, shown on the login page unless SHOW_DEMO_CREDENTIALS=0. */
export function demoHint(): { username: string; password: string } | undefined {
  return isAuthEnabled() && process.env.SHOW_DEMO_CREDENTIALS !== "0"
    ? { username: DEMO_USER, password: DEMO_PASSWORD }
    : undefined;
}

function safeEqual(a: string, b: string): boolean {
  const left = createHmac("sha256", "cmp").update(a).digest();
  const right = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(left, right);
}

export function credentialsValid(username: unknown, password: unknown): boolean {
  if (!isAuthEnabled() || typeof username !== "string" || typeof password !== "string") return false;
  // Both are always compared, so a wrong username takes as long as a wrong password.
  const userOk = safeEqual(username, DEMO_USER);
  const passOk = safeEqual(password, DEMO_PASSWORD);
  return userOk && passOk;
}

function sign(expires: string): string {
  return createHmac("sha256", SECRET).update(expires).digest("hex");
}

export function createSessionToken(): string {
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  return `${expires}.${sign(expires)}`;
}

export function sessionValid(token: string | undefined): boolean {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(signature, sign(expires));
}

/** Reads the session cookie straight from the request, so route handlers need no async cookie store. */
export function requestHasSession(request: Request): boolean {
  const header = request.headers.get("cookie") ?? "";
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return sessionValid(match?.slice(SESSION_COOKIE.length + 1));
}

/** Behind Cloudflare and nginx the client address is in a header, not the socket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip") ?? forwarded ?? request.headers.get("x-real-ip") ?? "unknown";
}

const hits = new Map<string, number[]>();

/** Sliding-window limiter, in memory (a restart resets it). Returns seconds to wait if over the limit. */
export function rateLimit(bucket: string, key: string, limit: number, windowMs: number): number | undefined {
  const id = `${bucket}:${key}`;
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(id, recent);
    return Math.ceil((recent[0] + windowMs - now) / 1000);
  }
  recent.push(now);
  hits.set(id, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return undefined;
}

export function isHttps(request: Request): boolean {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}
