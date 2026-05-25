// Form submission handler for /contact and /apply. Sends an email via
// Resend's REST API. Stateless, no SDK, no package.json needed.
//
// Required env vars (set in Vercel project settings):
//   RESEND_API_KEY     — from resend.com/api-keys
//   FORM_FROM_EMAIL    — verified sender, e.g. "Forms <forms@collinsandgamble.com>"
//                         until the domain is verified on Resend, the API
//                         will reject sends. For first-pass testing, set
//                         this to "onboarding@resend.dev" — Resend only
//                         lets that sender deliver to the account owner.
//
// Without RESEND_API_KEY the route returns 503 and the client falls back
// to its existing mailto: handler — nothing breaks, the form just opens
// the user's email client like before.

const ALLOWED_INBOXES = new Set([
  "hello@collinsandgamble.com",
  "apply@collinsandgamble.com",
]);

const prettify = (k) =>
  k.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Email service not configured" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const { to, subjectPrefix, fields, honeypot } = body;

  // Honeypot — silently succeed on bot submissions so they don't retry.
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return res.status(200).json({ ok: true });
  }

  if (!to || typeof to !== "string" || !ALLOWED_INBOXES.has(to)) {
    return res.status(400).json({ error: "Invalid recipient" });
  }
  if (!fields || typeof fields !== "object") {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const lines = [];
  for (const [k, v] of Object.entries(fields)) {
    if (k === "website") continue;
    const val = (v ?? "").toString().trim();
    if (val) lines.push(`${prettify(k)}: ${val}`);
  }
  if (lines.length === 0) {
    return res.status(400).json({ error: "Empty submission" });
  }
  const text = lines.join("\n\n") + "\n";

  const name = (fields.name ?? "").toString().trim();
  const subject = `${subjectPrefix || "Inquiry"}${name ? ` — ${name}` : ""}`;
  const replyTo = (fields.email ?? "").toString().trim();

  const from =
    process.env.FORM_FROM_EMAIL ||
    "Collins & Gamble <onboarding@resend.dev>";

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo || undefined,
      subject,
      text,
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    return res.status(502).json({ error: "Send failed", detail });
  }

  return res.status(200).json({ ok: true });
}
