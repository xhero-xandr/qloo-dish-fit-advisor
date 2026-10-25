// The menu-reading endpoint's logic: a file in a multipart form, or a Google link in JSON. Reading the
// dishes is passed in, so the checks can be tested without a model. Nothing the chef sends is stored.

import { clientKey, isAuthEnabled, limitFromEnv, rateLimit, requestHasSession } from "./auth.ts";
import { MAX_CONCEPT_LENGTH } from "./input.ts";
import {
  fetchGoogleText,
  MAX_MENU_FILE_BYTES,
  menuSourceFromFile,
  MenuSourceError,
  menuText,
  parseGoogleLink,
  type Dish,
  type MenuSource,
} from "./menu-source.ts";

// Each read is one model call with a whole page or photo in it. MENU_READS_PER_HOUR overrides it.
const READS_PER_HOUR = limitFromEnv(process.env.MENU_READS_PER_HOUR, 20);

export interface MenuRead {
  dishes: Dish[];
  /** The dishes as the "Dish or menu" field's text, as many as fit. */
  text: string;
  /** How many of the dishes are in `text`. */
  included: number;
  source: MenuSource["kind"];
  readBy: string;
}

export function createMenuHandler(
  read: (source: MenuSource) => Promise<{ dishes: Dish[]; readBy: string }>,
  fetchGoogle: typeof fetchGoogleText = fetchGoogleText,
) {
  return async function POST(request: Request) {
    if (isAuthEnabled() && !requestHasSession(request)) {
      return Response.json({ error: "Sign in with the demo account to read a menu.", code: "auth" }, { status: 401 });
    }
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_MENU_FILE_BYTES + 64 * 1024) {
      return Response.json({ error: `The file is over ${MAX_MENU_FILE_BYTES / 1024 / 1024} MB.` }, { status: 413 });
    }
    const wait = rateLimit("menu", clientKey(request), READS_PER_HOUR, 60 * 60_000);
    if (wait !== undefined) {
      return Response.json(
        { error: `Menu reading limit reached for this connection (${READS_PER_HOUR}/hour). Try again in ${Math.ceil(wait / 60)} minute(s).` },
        { status: 429, headers: { "Retry-After": String(wait) } },
      );
    }

    try {
      let source: MenuSource;
      if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
        let file: FormDataEntryValue | null;
        try {
          file = (await request.formData()).get("file");
        } catch {
          return Response.json({ error: "The upload did not arrive whole. Try again." }, { status: 400 });
        }
        if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
        source = menuSourceFromFile(new Uint8Array(await file.arrayBuffer()), file.name);
      } else {
        let body: { link?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body." }, { status: 400 });
        }
        const link = typeof body.link === "string" ? parseGoogleLink(body.link) : undefined;
        if (!link)
          return Response.json(
            { error: "Paste a Google Docs or Sheets link, starting with https://docs.google.com/." },
            { status: 400 },
          );
        source = await fetchGoogle(link);
      }
      const { dishes, readBy } = await read(source);
      const { text, included } = menuText(dishes, MAX_CONCEPT_LENGTH);
      const result: MenuRead = { dishes, text, included, source: source.kind, readBy };
      return Response.json(result);
    } catch (error) {
      if (error instanceof MenuSourceError) return Response.json({ error: error.message }, { status: 422 });
      console.warn("[menu] read failed:", error instanceof Error ? error.message : error);
      return Response.json({ error: "The menu could not be read. Try again, or type the dishes." }, { status: 502 });
    }
  };
}
