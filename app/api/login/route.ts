import { clientKey, createSessionToken, credentialsValid, isAuthEnabled, isHttps, rateLimit, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../../../lib/auth.ts";

const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 10 * 60_000;

export async function POST(request: Request) {
  if (!isAuthEnabled()) return Response.json({ ok: true });

  const wait = rateLimit("login", clientKey(request), MAX_ATTEMPTS, ATTEMPT_WINDOW_MS);
  if (wait !== undefined) {
    return Response.json(
      { error: `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!credentialsValid(body.username, body.password)) {
    return Response.json({ error: "Wrong username or password." }, { status: 401 });
  }

  const cookie = [
    `${SESSION_COOKIE}=${createSessionToken()}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    ...(isHttps(request) ? ["Secure"] : []),
  ].join("; ");
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}
