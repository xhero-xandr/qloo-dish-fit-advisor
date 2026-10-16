import { demoHint, isAuthEnabled, requestHasSession } from "../../../lib/auth.ts";

export async function GET(request: Request) {
  const authRequired = isAuthEnabled();
  const authenticated = !authRequired || requestHasSession(request);
  return Response.json(
    { authRequired, authenticated, demo: authenticated ? undefined : demoHint() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
