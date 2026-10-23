// Where a menu comes from when the chef does not type it: an uploaded photo or file, or a Google Docs or
// Sheets link. This module decides what a file is (from its bytes, not the name the browser sent), takes the
// text out of Word and Excel files, and downloads shared Google documents. Reading the dishes out of the
// result is the model's job (menu-reader.ts).

import { readZipEntry, zipEntryNames } from "./zip.ts";

export const MAX_MENU_FILE_BYTES = 10 * 1024 * 1024;
/** Text handed to the model, after extraction. A long menu is a few thousand characters. */
export const MAX_MENU_TEXT_LENGTH = 30_000;
const MAX_XML_BYTES = 8 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 1024 * 1024;
const MAX_SHEETS = 5;

/** A problem the chef can fix: the message is shown as it is. */
export class MenuSourceError extends Error {}

/** What the model is given: the file itself for photos and PDFs, which it reads natively, or plain text. */
export type MenuSource =
  | { kind: "image" | "pdf"; mediaType: string; bytes: Uint8Array }
  | { kind: "text" | "word" | "excel" | "google"; text: string };

const OLD_OFFICE =
  "This looks like an old Word or Excel file (.doc or .xls). Save it as .docx, .xlsx or PDF and upload that.";
const UNSUPPORTED =
  "This file type can't be read. Upload a photo, a PDF, a Word (.docx) or Excel (.xlsx) file, or a CSV or text file.";

function startsWith(bytes: Uint8Array, signature: number[], at = 0): boolean {
  return signature.every((b, i) => bytes[at + i] === b);
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.subarray(from, to));
}

function imageType(bytes: Uint8Array): string | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 8) === "ftyp" && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(ascii(bytes, 8, 12)))
    return "image/heic";
  return undefined;
}

/** Turns an uploaded file into what the model reads, or throws a MenuSourceError saying what to upload instead. */
export function menuSourceFromFile(bytes: Uint8Array, filename: string): MenuSource {
  if (bytes.length === 0) throw new MenuSourceError("The file is empty.");
  if (bytes.length > MAX_MENU_FILE_BYTES)
    throw new MenuSourceError(`The file is over ${MAX_MENU_FILE_BYTES / 1024 / 1024} MB. Upload a smaller photo or export fewer pages.`);
  const image = imageType(bytes);
  if (image) return { kind: "image", mediaType: image, bytes };
  if (ascii(bytes, 0, 5) === "%PDF-") return { kind: "pdf", mediaType: "application/pdf", bytes };
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) throw new MenuSourceError(OLD_OFFICE);
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const names = zipEntryNames(buf);
    if (names.includes("word/document.xml")) return { kind: "word", text: needText(docxText(buf)) };
    if (names.includes("xl/workbook.xml")) return { kind: "excel", text: needText(xlsxText(buf)) };
    throw new MenuSourceError(UNSUPPORTED);
  }
  if (/\.(txt|csv|tsv|md)$/i.test(filename) || !/\.[a-z0-9]{2,5}$/i.test(filename)) {
    try {
      return { kind: "text", text: needText(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
    } catch (error) {
      if (error instanceof MenuSourceError) throw error;
    }
  }
  throw new MenuSourceError(UNSUPPORTED);
}

function needText(text: string): string {
  const clean = text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  if (!/\p{L}{2,}/u.test(clean)) throw new MenuSourceError("No text was found in the file.");
  return clean.slice(0, MAX_MENU_TEXT_LENGTH);
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xml(buf: Buffer, name: string): string {
  return readZipEntry(buf, name, MAX_XML_BYTES)?.toString("utf8") ?? "";
}

/** The paragraphs of a .docx, one per line; tables come out cell by cell. */
export function docxText(buf: Buffer): string {
  const body = xml(buf, "word/document.xml");
  let out = "";
  for (const m of body.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<\/w:p>|<w:tab\/>|<w:br\b[^>]*\/>/g)) {
    if (m[1] !== undefined) out += decodeXml(m[1]);
    else out += m[0] === "<w:tab/>" ? " " : "\n";
  }
  return out;
}

/** The rows of the first few sheets of an .xlsx, cells separated by " | ". */
export function xlsxText(buf: Buffer): string {
  const shared = [...xml(buf, "xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) =>
    [...si[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((t) => decodeXml(t[1])).join(""),
  );
  const sheets = zipEntryNames(buf)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    .slice(0, MAX_SHEETS);
  const lines: string[] = [];
  for (const sheet of sheets) {
    for (const row of xml(buf, sheet).matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const cells: string[] = [];
      for (const c of (row[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const type = c[1].match(/\bt="([^"]+)"/)?.[1];
        const inner = c[2] ?? "";
        const value = inner.match(/<v>([^<]*)<\/v>/)?.[1];
        const text =
          type === "s"
            ? shared[Number(value)]
            : type === "inlineStr"
              ? [...inner.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((t) => decodeXml(t[1])).join("")
              : value !== undefined
                ? decodeXml(value)
                : undefined;
        if (text?.trim()) cells.push(text.trim());
      }
      if (cells.length > 0) lines.push(cells.join(" | "));
    }
  }
  return lines.join("\n");
}

export interface GoogleLink {
  kind: "document" | "spreadsheets";
  id: string;
  /** A "Publish to the web" link (/d/e/…), which has its own download address. */
  published: boolean;
  /** The sheet tab, for spreadsheets. */
  gid?: string;
}

/** A Google Docs or Sheets link, or undefined for anything else. Only docs.google.com over https is accepted. */
export function parseGoogleLink(raw: string): GoogleLink | undefined {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") return undefined;
  const m = url.pathname.match(/^\/(document|spreadsheets)\/d\/(e\/)?([A-Za-z0-9_-]{20,200})(?:\/|$)/);
  if (!m) return undefined;
  const gid = (url.hash.match(/gid=(\d+)/) ?? url.search.match(/[?&]gid=(\d+)/))?.[1];
  return { kind: m[1] as GoogleLink["kind"], id: m[3], published: Boolean(m[2]), ...(gid ? { gid } : {}) };
}

/** Where Google serves the document as plain text (Docs) or CSV (Sheets). Built from the id, never from the pasted URL. */
export function googleExportUrl(link: GoogleLink): string {
  const base = `https://docs.google.com/${link.kind}/d/${link.published ? "e/" : ""}${link.id}`;
  const gid = link.gid ? `&gid=${link.gid}` : "";
  if (link.kind === "document") return link.published ? `${base}/pub?output=txt` : `${base}/export?format=txt`;
  return link.published ? `${base}/pub?output=csv${gid}` : `${base}/export?format=csv${gid}`;
}

const NOT_SHARED =
  'Google asked for a sign-in, so the document is not shared. In Google, choose Share → General access → "Anyone with the link" (Viewer), then paste the link again.';

/** Google sends exports on to its download servers; nothing else is followed. */
function isGoogleDownloadHost(url: URL): boolean {
  return url.protocol === "https:" && (url.hostname === "docs.google.com" || url.hostname.endsWith(".googleusercontent.com"));
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

/** Downloads a shared Google document as text. Throws a MenuSourceError the chef can act on. */
export async function fetchGoogleText(link: GoogleLink, fetchImpl: typeof fetch = fetch): Promise<MenuSource> {
  let url = new URL(googleExportUrl(link));
  for (let hop = 0; hop < 4; hop++) {
    let res: Response;
    try {
      res = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new MenuSourceError("Google could not be reached. Try again in a minute.");
    }
    if (res.status >= 300 && res.status < 400) {
      const next = new URL(res.headers.get("location") ?? "", url);
      if (next.hostname === "accounts.google.com") throw new MenuSourceError(NOT_SHARED);
      if (!isGoogleDownloadHost(next)) throw new MenuSourceError("Google sent the download somewhere unexpected, so it was not followed.");
      url = next;
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new MenuSourceError(NOT_SHARED);
    if (res.status === 404) throw new MenuSourceError("Google says this document does not exist. Check the link.");
    if (!res.ok) throw new MenuSourceError(`Google answered ${res.status}. Try again in a minute.`);
    // A sign-in or error page comes back as HTML with 200.
    if (/text\/html/i.test(res.headers.get("content-type") ?? "")) throw new MenuSourceError(NOT_SHARED);
    return { kind: "google", text: needText(await readCapped(res, MAX_DOWNLOAD_BYTES)) };
  }
  throw new MenuSourceError("Google redirected too many times. Try again in a minute.");
}

export interface Dish {
  name: string;
  /** The menu's section ("Starters", "Ramen"), when there is one. */
  section?: string;
}

const MAX_DISHES = 60;
const MAX_DISH_LENGTH = 100;

/** Trims, drops empty and repeated names, and caps the list. */
export function cleanDishes(raw: { name?: unknown; section?: unknown }[]): Dish[] {
  const seen = new Set<string>();
  const dishes: Dish[] = [];
  for (const d of raw) {
    const name = typeof d.name === "string" ? d.name.replace(/\s+/g, " ").trim().slice(0, MAX_DISH_LENGTH) : "";
    const key = name.toLowerCase();
    if (!/\p{L}{2,}/u.test(name) || seen.has(key)) continue;
    seen.add(key);
    const section = typeof d.section === "string" ? d.section.replace(/\s+/g, " ").trim().slice(0, 40) : "";
    dishes.push(section ? { name, section } : { name });
    if (dishes.length >= MAX_DISHES) break;
  }
  return dishes;
}

/** Without a model: each short line of the text is taken as a dish, prices and separators stripped. */
export function dishesFromLines(text: string): Dish[] {
  return cleanDishes(
    text
      .split("\n")
      .map((line) => line.split(" | ").filter((c) => /\p{L}{2,}/u.test(c)).join(", "))
      .map((line) => line.replace(/[$€£₽]\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?[$€£₽]/g, "").replace(/[\s.·–—-]+$/, ""))
      .filter((line) => line.length <= MAX_DISH_LENGTH)
      .map((name) => ({ name })),
  );
}

/** The dishes as the text of the "Dish or menu" field, one per line, as many as fit in `max` characters. */
export function menuText(dishes: Dish[], max: number): { text: string; included: number } {
  let text = "";
  let included = 0;
  for (const d of dishes) {
    const next = text ? `${text}\n${d.name}` : d.name;
    if (next.length > max) break;
    text = next;
    included++;
  }
  return { text, included };
}
