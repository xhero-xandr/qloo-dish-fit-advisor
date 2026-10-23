import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import {
  cleanDishes,
  dishesFromLines,
  fetchGoogleText,
  googleExportUrl,
  menuSourceFromFile,
  MenuSourceError,
  menuText,
  parseGoogleLink,
} from "../lib/menu-source.ts";
import { readZipEntry } from "../lib/zip.ts";

/** A minimal zip with deflated entries, as Word and Excel write them. */
function zip(files: Record<string, string>): Uint8Array {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(content));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(content), 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(Buffer.byteLength(content), 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, dir, end]));
}

const fails = (fn: () => unknown, pattern: RegExp) =>
  assert.throws(fn, (e) => e instanceof MenuSourceError && pattern.test(e.message));

test("photos and PDFs are recognised by their bytes, whatever the name says", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  assert.deepEqual(menuSourceFromFile(jpeg, "menu.pdf"), { kind: "image", mediaType: "image/jpeg", bytes: jpeg });
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  assert.equal((menuSourceFromFile(png, "x") as { mediaType: string }).mediaType, "image/png");
  const heic = new Uint8Array([0, 0, 0, 24, ...Buffer.from("ftypheic")]);
  assert.equal((menuSourceFromFile(heic, "IMG_1.HEIC") as { mediaType: string }).mediaType, "image/heic");
  const pdf = new Uint8Array(Buffer.from("%PDF-1.7\n..."));
  assert.equal(menuSourceFromFile(pdf, "menu").kind, "pdf");
});

test("a Word file comes out as its paragraphs, entities decoded", () => {
  const doc = zip({
    "[Content_Types].xml": "<Types/>",
    "word/document.xml":
      '<w:document><w:body><w:p><w:r><w:t>Starters</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Gyoza </w:t></w:r><w:r><w:t>&amp; dipping sauce</w:t></w:r><w:r><w:tab/><w:t>$9</w:t></w:r></w:p></w:body></w:document>',
  });
  assert.deepEqual(menuSourceFromFile(doc, "menu.docx"), { kind: "word", text: "Starters\nGyoza & dipping sauce $9" });
});

test("an Excel file comes out row by row, shared and inline strings and numbers", () => {
  const book = zip({
    "xl/workbook.xml": "<workbook/>",
    "xl/sharedStrings.xml": "<sst><si><t>Dish</t></si><si><t>Price</t></si><si><r><t>Spicy </t></r><r><t>miso ramen</t></r></si></sst>",
    "xl/worksheets/sheet1.xml":
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"/><row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>14.5</v></c></row><row r="4"><c t="inlineStr"><is><t>Matcha soft serve</t></is></c></row></sheetData></worksheet>',
  });
  assert.deepEqual(menuSourceFromFile(book, "menu.xlsx"), {
    kind: "excel",
    text: "Dish | Price\nSpicy miso ramen | 14.5\nMatcha soft serve",
  });
});

test("CSV and text are read as UTF-8; other files get a message saying what to upload", () => {
  assert.deepEqual(menuSourceFromFile(new Uint8Array(Buffer.from("Борщ,450\nPelmeni,380\n")), "menu.csv"), {
    kind: "text",
    text: "Борщ,450\nPelmeni,380",
  });
  fails(() => menuSourceFromFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), "menu.doc"), /\.docx, \.xlsx or PDF/);
  fails(() => menuSourceFromFile(zip({ "other.txt": "x" }), "a.zip"), /can't be read/);
  fails(() => menuSourceFromFile(new Uint8Array(Buffer.from("GIF89a")), "menu.gif"), /can't be read/);
  fails(() => menuSourceFromFile(new Uint8Array(), "menu.txt"), /empty/);
  fails(() => menuSourceFromFile(new Uint8Array(Buffer.from("123, 456\n")), "menu.csv"), /No text/);
});

test("a zip entry that would inflate past the cap is not read", () => {
  const big = Buffer.from(zip({ "word/document.xml": "a".repeat(10_000) }));
  assert.equal(readZipEntry(big, "word/document.xml", 1000), undefined);
  assert.equal(readZipEntry(big, "word/document.xml", 20_000)?.length, 10_000);
  assert.equal(readZipEntry(Buffer.from("not a zip at all, just bytes"), "x", 10), undefined);
});

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-";

test("only docs.google.com Docs and Sheets links are accepted, and the download address is built from the id", () => {
  assert.deepEqual(parseGoogleLink(`https://docs.google.com/document/d/${ID}/edit?usp=sharing`), {
    kind: "document",
    id: ID,
    published: false,
  });
  const sheet = parseGoogleLink(`  https://docs.google.com/spreadsheets/d/${ID}/edit#gid=123  `)!;
  assert.equal(googleExportUrl(sheet), `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=123`);
  const pub = parseGoogleLink(`https://docs.google.com/document/d/e/2PACX-${ID}/pub`)!;
  assert.equal(googleExportUrl(pub), `https://docs.google.com/document/d/e/2PACX-${ID}/pub?output=txt`);
  for (const bad of [
    `http://docs.google.com/document/d/${ID}/edit`,
    `https://docs.google.com.evil.example/document/d/${ID}/edit`,
    `https://evil.example/?u=https://docs.google.com/document/d/${ID}`,
    `https://drive.google.com/file/d/${ID}/view`,
    `https://docs.google.com/presentation/d/${ID}/edit`,
    "https://docs.google.com/document/d/short/edit",
    "not a url",
  ])
    assert.equal(parseGoogleLink(bad), undefined, bad);
});

function fakeFetch(responses: Response[], seen: string[] = []): typeof fetch {
  return (async (url: URL | string) => {
    seen.push(String(url));
    return responses.shift()!;
  }) as typeof fetch;
}
const doc = parseGoogleLink(`https://docs.google.com/document/d/${ID}/edit`)!;

test("a shared document is followed to Google's download server and read as text", async () => {
  const seen: string[] = [];
  const source = await fetchGoogleText(
    doc,
    fakeFetch(
      [
        new Response(null, { status: 307, headers: { location: "https://doc-0s-docs.googleusercontent.com/export/abc" } }),
        new Response("﻿Tonkotsu ramen\r\n\r\nGyoza\r\n", { headers: { "content-type": "text/plain; charset=utf-8" } }),
      ],
      seen,
    ),
  );
  assert.equal(source.kind, "google");
  assert.equal((source as { text: string }).text, "Tonkotsu ramen\nGyoza");
  assert.deepEqual(seen, [`https://docs.google.com/document/d/${ID}/export?format=txt`, "https://doc-0s-docs.googleusercontent.com/export/abc"]);
});

test("a private document, a missing one, or a redirect off Google each say what happened", async () => {
  const run = (r: Response) => fetchGoogleText(doc, fakeFetch([r]));
  const signIn = new Response(null, { status: 302, headers: { location: "https://accounts.google.com/ServiceLogin?continue=x" } });
  await assert.rejects(run(signIn), /Anyone with the link/);
  await assert.rejects(run(new Response("<html>", { headers: { "content-type": "text/html" } })), /Anyone with the link/);
  await assert.rejects(run(new Response("", { status: 404 })), /does not exist/);
  await assert.rejects(run(new Response(null, { status: 302, headers: { location: "https://evil.example/x" } })), /not followed/);
  await assert.rejects(
    fetchGoogleText(doc, (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch),
    /could not be reached/,
  );
});

test("dishes are trimmed, deduplicated and capped; the field text keeps whole lines under the limit", () => {
  assert.deepEqual(
    cleanDishes([{ name: "  Gyoza  " }, { name: "gyoza" }, { name: "" }, { name: 3 }, { name: "Ramen", section: " Mains " }]),
    [{ name: "Gyoza" }, { name: "Ramen", section: "Mains" }],
  );
  assert.equal(cleanDishes(Array.from({ length: 80 }, (_, i) => ({ name: `Dish ${i}` }))).length, 60);
  assert.deepEqual(menuText([{ name: "Gyoza" }, { name: "Spicy miso ramen" }, { name: "Mochi" }], 22), {
    text: "Gyoza\nSpicy miso ramen",
    included: 2,
  });
});

test("without a model, each line is a dish with its price taken off", () => {
  assert.deepEqual(dishesFromLines("Dish | Price\nSpicy miso ramen | 14.5\nGyoza — $9\nMochi 6€\n---"), [
    { name: "Dish, Price" },
    { name: "Spicy miso ramen" },
    { name: "Gyoza" },
    { name: "Mochi" },
  ]);
});
