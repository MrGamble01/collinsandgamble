import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import handler from "../api/submit.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.FORM_FROM_EMAIL;

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function post(body) {
  const res = mockRes();
  return handler({ method: "POST", body }, res).then(() => res);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
  if (originalFrom === undefined) delete process.env.FORM_FROM_EMAIL;
  else process.env.FORM_FROM_EMAIL = originalFrom;
});

test("rejects anything other than POST", async () => {
  const res = mockRes();
  await handler({ method: "GET", body: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

const contact = (fields, extra = {}) => ({
  to: "hello@collinsandgamble.com",
  form: "contact",
  fields: { name: "Ada", email: "ada@example.com", side: "other", message: "Hello", ...fields },
  ...extra,
});

test("asks the browser to fall back when email is not configured", async () => {
  delete process.env.RESEND_API_KEY;
  const res = await post(contact({}));
  assert.equal(res.statusCode, 503);
});

test("refuses an inbox the form is not allowed to choose", async () => {
  process.env.RESEND_API_KEY = "test-key";
  const res = await post(contact({}, { to: "someone@example.com" }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Invalid recipient.");
});

test("refuses a form it does not know", async () => {
  process.env.RESEND_API_KEY = "test-key";
  const res = await post(contact({}, { form: "roster" }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Unknown form.");
});

test("refuses a missing name, a bad email, and an overlong note", async () => {
  process.env.RESEND_API_KEY = "test-key";
  const missing = await post(contact({ name: "   " }));
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.body.error, "Enter your name.");

  const email = await post(contact({ email: "not an email" }));
  assert.equal(email.statusCode, 400);
  assert.equal(email.body.error, "Enter a valid email.");

  const long = await post(contact({ message: "x".repeat(2001) }));
  assert.equal(long.statusCode, 400);
  assert.equal(long.body.error, "That note is too long.");
});

test("refuses a link that is not http or https", async () => {
  process.env.RESEND_API_KEY = "test-key";
  const res = await post(contact({ link: "javascript:alert(1)" }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Enter a link that starts with http or https.");
});

test("swallows a filled honeypot without calling Resend", async () => {
  process.env.RESEND_API_KEY = "test-key";
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("{}", { status: 200 }); };
  const res = await post({
    to: "hello@collinsandgamble.com",
    fields: { message: "Hello" },
    honeypot: "https://spam.example",
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(called, false);
});

test("refuses an empty note", async () => {
  process.env.RESEND_API_KEY = "test-key";
  const res = await post({
    to: "apply@collinsandgamble.com",
    form: "apply",
    fields: { name: "   ", email: "", storefront: "" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Enter your name.");
});

test("sends a roster application with a checked reply-to", async () => {
  process.env.RESEND_API_KEY = "test-key";
  delete process.env.FORM_FROM_EMAIL;
  let sent;
  globalThis.fetch = async (url, opts) => {
    sent = { url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
    return new Response("{}", { status: 200 });
  };
  const res = await post({
    to: "apply@collinsandgamble.com",
    form: "apply",
    subjectPrefix: "Ignore this prefix",
    fields: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      storefront: "https://www.amazon.com/shop/example",
      why: "I film on Tuesdays",
    },
    honeypot: "",
  });
  assert.equal(res.statusCode, 200);
  assert.equal(sent.url, "https://api.resend.com/emails");
  assert.equal(sent.auth, "Bearer test-key");
  assert.equal(sent.body.to[0], "apply@collinsandgamble.com");
  assert.equal(sent.body.reply_to, "ada@example.com");
  assert.equal(sent.body.subject, "Roster application — Ada Lovelace");
  assert.match(sent.body.text, /I film on Tuesdays/);
  assert.equal(sent.body.from, "Collins & Gamble <onboarding@resend.dev>");
});

test("keeps a real reply-to address", async () => {
  process.env.RESEND_API_KEY = "test-key";
  let sent;
  globalThis.fetch = async (_url, opts) => {
    sent = JSON.parse(opts.body);
    return new Response("{}", { status: 200 });
  };
  const res = await post(contact({ side: "brand" }));
  assert.equal(res.statusCode, 200);
  assert.equal(sent.reply_to, "ada@example.com");
  assert.equal(sent.subject, "Brand inquiry — Ada");
});

test("reports a provider failure instead of pretending it sent", async () => {
  process.env.RESEND_API_KEY = "test-key";
  globalThis.fetch = async () => new Response("nope", { status: 422 });
  const res = await post(contact({}));
  assert.equal(res.statusCode, 502);

  globalThis.fetch = async () => { throw new Error("offline"); };
  const again = await post(contact({}));
  assert.equal(again.statusCode, 502);
});
