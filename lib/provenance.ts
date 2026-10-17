// Where each fact came from. A fact shown to the agent (and to the visitor) carries the Qloo request
// that produced it, so a claim can be traced to an endpoint and parameters and re-run. The request
// parameters are built here, by the same functions that make the calls (lib/qloo.ts), so what is
// shown cannot drift from what was sent. The API key is never part of a request's parameters.

export type QlooParams = Record<string, string | number | boolean>;

export interface QlooRequest {
  path: string;
  params: QlooParams;
}

/** The Qloo requests behind a fact, and when the fact is worked out here from them, how. */
export interface FactSource {
  /** The Qloo host the requests were sent to. */
  base: string;
  requests: QlooRequest[];
  /** Present when the fact is computed in this app from the requests rather than read straight from one. */
  note?: string;
}

export function tagSearchParams(query: string, limit: number): QlooParams {
  return {
    "filter.query": query,
    "feature.semantic_search": true,
    take: limit,
  };
}

export function placeSearchParams(
  tagIds: readonly string[],
  city: string,
  take: number,
  audience?: { age?: readonly string[]; gender?: string },
): QlooParams {
  return {
    "filter.type": "urn:entity:place",
    "filter.tags": tagIds.join(","),
    "filter.location.query": city,
    "filter.location.radius": 0,
    ...(audience?.age?.length
      ? { "signal.demographics.age": audience.age.join(",") }
      : {}),
    ...(audience?.gender
      ? { "signal.demographics.gender": audience.gender }
      : {}),
    take,
  };
}

export function demographicsParams(entityId: string): QlooParams {
  return {
    "filter.type": "urn:demographics",
    "signal.interests.entities": entityId,
    take: 1,
  };
}

export function recommendParams(
  entityIds: readonly string[],
  targetType: string,
  location: string,
  take: number,
): QlooParams {
  return {
    "filter.type": targetType,
    "signal.interests.entities": entityIds.join(","),
    "signal.location.query": location,
    take,
  };
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

/** A curl command that repeats the request. The key is a placeholder for the reader's own. */
export function curlFor(base: string, request: QlooRequest): string {
  const params = Object.entries(request.params).map(
    ([k, v]) => `  --data-urlencode ${shellQuote(`${k}=${v}`)}`,
  );
  return [
    `curl -G ${shellQuote(base.replace(/\/$/, "") + request.path)} \\`,
    `  -H 'X-Api-Key: '"$QLOO_API_KEY" \\`,
    ...params.map((p, i) => (i < params.length - 1 ? `${p} \\` : p)),
  ].join("\n");
}

/** One line for the page: the method, the path and the parameters. */
export function describeRequest(request: QlooRequest): string {
  const params = Object.entries(request.params).map(([k, v]) => `${k}=${v}`);
  return `GET ${request.path}${params.length > 0 ? ` · ${params.join(" · ")}` : ""}`;
}
