// Shared rules for /contact, /apply, and /brands. The browser checks the
// same required fields before posting; this module is what the API trusts.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

const FORMS = {
  contact: {
    inbox: "hello@collinsandgamble.com",
    required: ["name", "email", "side"],
    urls: ["link"],
    multiline: ["message"],
    enums: { side: ["creator", "brand", "other"] },
    fields: {
      name: 120,
      email: 254,
      side: 20,
      link: 500,
      "looking-for": 80,
      message: 2000,
    },
    subject(fields) {
      if (fields.side === "creator") return "Creator inquiry";
      if (fields.side === "brand") return "Brand inquiry";
      return "Inquiry";
    },
  },
  apply: {
    inbox: "apply@collinsandgamble.com",
    required: ["name", "email", "storefront"],
    urls: ["storefront"],
    multiline: ["why", "other"],
    fields: {
      name: 120,
      email: 254,
      location: 120,
      social: 200,
      storefront: 500,
      "aip-time": 80,
      "storefront-earnings": 80,
      categories: 200,
      audience: 80,
      "upload-cadence": 80,
      why: 2000,
      other: 2000,
    },
    subject() {
      return "Roster application";
    },
  },
  brand: {
    inbox: "hello@collinsandgamble.com",
    required: ["company", "name", "email", "listing"],
    urls: ["listing"],
    multiline: ["success", "other"],
    fields: {
      company: 120,
      role: 120,
      name: 120,
      email: 254,
      listing: 500,
      categories: 200,
      asins: 80,
      "price-point": 80,
      goal: 80,
      budget: 80,
      timeline: 80,
      success: 2000,
      other: 2000,
    },
    subject() {
      return "Brand inquiry";
    },
  },
};

function fail(status, error) {
  return { ok: false, status, error };
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function requiredMessage(key) {
  if (key === "email") return "Enter a valid email.";
  if (key === "name") return "Enter your name.";
  if (key === "company") return "Enter the company name.";
  if (key === "side") return "Choose creator, brand, or other.";
  if (key === "storefront" || key === "listing") return "Enter a link that starts with http or https.";
  return "Check the form and try again.";
}

export function checkSubmission(body) {
  const payload = body && typeof body === "object" ? body : {};
  const spec = FORMS[payload.form];
  if (!spec) return fail(400, "Unknown form.");
  if (payload.to !== spec.inbox) return fail(400, "Invalid recipient.");

  const fields = payload.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return fail(400, "Invalid payload.");
  }

  const keys = Object.keys(fields);
  if (keys.length > 20) return fail(400, "Invalid payload.");

  const clean = {};
  for (const key of keys) {
    const limit = spec.fields[key];
    if (!limit) return fail(400, "Invalid payload.");
    const value = fields[key];
    if (typeof value !== "string") return fail(400, "Invalid payload.");
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed.length > limit) return fail(400, "That note is too long.");
    if (CONTROL.test(trimmed)) return fail(400, "Invalid payload.");
    if (!spec.multiline.includes(key) && /[\r\n]/.test(trimmed)) {
      return fail(400, "Invalid payload.");
    }
    clean[key] = trimmed;
  }

  for (const key of spec.required) {
    if (!clean[key]) return fail(400, requiredMessage(key));
  }
  if (!EMAIL.test(clean.email) || clean.email.length > spec.fields.email) {
    return fail(400, "Enter a valid email.");
  }
  if (spec.enums) {
    for (const [key, allowed] of Object.entries(spec.enums)) {
      if (!allowed.includes(clean[key])) return fail(400, requiredMessage(key));
    }
  }
  for (const key of spec.urls) {
    if (clean[key] && !isHttpUrl(clean[key])) {
      return fail(400, "Enter a link that starts with http or https.");
    }
  }

  const name = clean.name || "";
  return {
    ok: true,
    to: spec.inbox,
    subject: `${spec.subject(clean)}${name ? ` — ${name}` : ""}`,
    fields: clean,
    replyTo: clean.email,
  };
}
