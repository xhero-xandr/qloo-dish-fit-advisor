import { buildPilotPackage, ConceptNotFoundError } from "@/lib/pilot-package";

const MAX_CONCEPT_LENGTH = 200;
const MAX_CITY_LENGTH = 100;

export async function POST(request: Request) {
  let body: { concept?: unknown; city?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const concept = typeof body.concept === "string" ? body.concept.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";

  if (!concept || !city) {
    return Response.json({ error: "Both 'concept' and 'city' are required." }, { status: 400 });
  }
  if (concept.length > MAX_CONCEPT_LENGTH || city.length > MAX_CITY_LENGTH) {
    return Response.json(
      { error: `Keep the concept under ${MAX_CONCEPT_LENGTH} characters and the city under ${MAX_CITY_LENGTH}.` },
      { status: 400 }
    );
  }

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
