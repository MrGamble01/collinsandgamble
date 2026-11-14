// Form submission handler for /contact, /apply, and /brands. Sends an email
// via Resend's REST API. Stateless, no SDK.
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
// to its mailto: handler. A filled honeypot or a failed check never gets
// that far.

import { checkSubmission } from "./form-check.js";

const prettify = (k) =>
  k.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const honeypot = body.honeypot;
  // Silent success so a bot does not learn which fields failed.
  if (typeof honeypot === "string" ? honeypot.trim() !== "" : honeypot) {
    return res.status(200).json({ ok: true });
  }

  const checked = checkSubmission(body);
  if (!checked.ok) {
    return res.status(checked.status).json({ error: checked.error });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Email service not configured" });
  }

  const lines = [];
  for (const [k, v] of Object.entries(checked.fields)) {
    lines.push(`${prettify(k)}: ${v}`);
  }
  const text = lines.join("\n\n") + "\n";

  const from =
    process.env.FORM_FROM_EMAIL ||
    "Collins & Gamble <onboarding@resend.dev>";

  let r;
  try {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [checked.to],
        reply_to: checked.replyTo,
        subject: checked.subject,
        text,
      }),
    });
  } catch (_err) {
    return res.status(502).json({ error: "Send failed" });
  }

  if (!r.ok) {
    return res.status(502).json({ error: "Send failed" });
  }

  return res.status(200).json({ ok: true });
}
