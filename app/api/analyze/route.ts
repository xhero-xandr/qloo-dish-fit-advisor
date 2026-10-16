import { clientKey, isAuthEnabled, rateLimit, requestHasSession } from "@/lib/auth";
import { validateInput } from "@/lib/input";
import { buildPilotPackage, ConceptNotFoundError } from "@/lib/pilot-package";

// Per client: each analysis spends shared Qloo and Gemini quota. Comparing several cities
// sends one request per city, so this leaves room for a few comparisons an hour.
const ANALYSES_PER_HOUR = 30;

export async function POST(request: Request) {
  if (isAuthEnabled() && !requestHasSession(request)) {
    return Response.json({ error: "Sign in with the demo account to run an analysis.", code: "auth" }, { status: 401 });
  }
  const wait = rateLimit("analyze", clientKey(request), ANALYSES_PER_HOUR, 60 * 60_000);
  if (wait !== undefined) {
    return Response.json(
      { error: `Analysis limit reached for this connection (${ANALYSES_PER_HOUR}/hour). Try again in ${Math.ceil(wait / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  let body: { concept?: unknown; city?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const concept = typeof body.concept === "string" ? body.concept.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";

  const problem = validateInput(concept, city);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  try {
    const result = await buildPilotPackage(concept, city);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ConceptNotFoundError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unknown error while calling Qloo.";
    return Response.json({ error: message }, { status: 502 });
  }
}
