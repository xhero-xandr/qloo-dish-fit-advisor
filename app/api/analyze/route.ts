import { buildPilotPackage } from "@/lib/pilot-package";

export async function POST(request: Request) {
  let body: { concept?: string; city?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const concept = body.concept?.trim();
  const city = body.city?.trim();

  if (!concept || !city) {
    return Response.json({ error: "Both 'concept' and 'city' are required." }, { status: 400 });
  }

  try {
    const result = await buildPilotPackage(concept, city);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error while calling Qloo.";
    return Response.json({ error: message }, { status: 502 });
  }
}
