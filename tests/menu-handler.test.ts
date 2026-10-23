import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DEMO_PASSWORD = "pw";
process.env.DEMO_USER = "demo";
const auth = await import("../lib/auth.ts");
const { createMenuHandler } = await import("../lib/menu-handler.ts");
const { MenuSourceError } = await import("../lib/menu-source.ts");

const signedIn = () => `${auth.SESSION_COOKIE}=${auth.createSessionToken()}`;
let client = 0;
function headers(extra: Record<string, string> = {}, cookie: string | null = signedIn()) {
  return { "cf-connecting-ip": `10.1.0.${++client}`, ...(cookie ? { cookie } : {}), ...extra };
}
function upload(bytes: string, name: string, cookie?: string | null) {
  const form = new FormData();
  form.set("file", new File([bytes], name));
  return new Request("http://x/api/menu", { method: "POST", headers: headers({}, cookie), body: form });
}
function link(value: unknown) {
  return new Request("http://x/api/menu", {
    method: "POST",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify({ link: value }),
  });
}

const seen: { kind: string }[] = [];
const handler = createMenuHandler(
  async (source) => {
    seen.push(source);
    return { dishes: [{ name: "Gyoza", section: "Starters" }, { name: "Spicy miso ramen" }], readBy: "test-model" };
  },
  async () => ({ kind: "google", text: "Gyoza\nSpicy miso ramen" }),
);

test("an uploaded file is read into dishes and the text for the menu field", async () => {
  const res = await handler(upload("Gyoza\nSpicy miso ramen\n", "menu.txt"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    dishes: [{ name: "Gyoza", section: "Starters" }, { name: "Spicy miso ramen" }],
    text: "Gyoza\nSpicy miso ramen",
    included: 2,
    source: "text",
    readBy: "test-model",
  });
});

test("without a session nothing is read", async () => {
  const before = seen.length;
  const res = await handler(upload("Gyoza", "menu.txt", null));
  assert.equal(res.status, 401);
  assert.equal(seen.length, before);
});

test("a file that can't be read, or a link that isn't Google's, is refused with a message", async () => {
  const gif = await handler(upload("GIF89a", "menu.gif"));
  assert.equal(gif.status, 422);
  assert.match((await gif.json()).error, /photo, a PDF/);
  const notGoogle = await handler(link("https://example.com/menu"));
  assert.equal(notGoogle.status, 400);
  assert.match((await notGoogle.json()).error, /docs\.google\.com/);
  const noFile = await handler(
    new Request("http://x/api/menu", { method: "POST", headers: headers(), body: new FormData() }),
  );
  assert.equal(noFile.status, 400);
});

test("a Google link goes through the downloader", async () => {
  const res = await handler(link("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit"));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).source, "google");
});

test("a declared body over the size cap is refused before it is read", async () => {
  const res = await handler(
    new Request("http://x/api/menu", {
      method: "POST",
      headers: headers({ "content-type": "multipart/form-data; boundary=x", "content-length": String(20 * 1024 * 1024) }),
      body: "x",
    }),
  );
  assert.equal(res.status, 413);
});

test("the reader's own problems reach the chef; anything else is a generic 502", async () => {
  const says = createMenuHandler(async () => {
    throw new MenuSourceError("No dishes found: a parking ticket");
  });
  const r1 = await says(upload("Gyoza", "menu.txt"));
  assert.equal(r1.status, 422);
  assert.equal((await r1.json()).error, "No dishes found: a parking ticket");
  const breaks = createMenuHandler(async () => {
    throw new Error("secret internal detail");
  });
  const r2 = await breaks(upload("Gyoza", "menu.txt"));
  assert.equal(r2.status, 502);
  assert.doesNotMatch((await r2.json()).error, /secret/);
});

test("reads are limited per connection", async () => {
  const ip = "10.9.9.9";
  const req = () => {
    const form = new FormData();
    form.set("file", new File(["Gyoza"], "menu.txt"));
    return new Request("http://x/api/menu", { method: "POST", headers: { "cf-connecting-ip": ip, cookie: signedIn() }, body: form });
  };
  for (let i = 0; i < 20; i++) assert.equal((await handler(req())).status, 200);
  const limited = await handler(req());
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
});
