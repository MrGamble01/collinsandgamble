(() => {
  document.documentElement.classList.add("js");

  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  const reveal = document.querySelectorAll(".reveal");
  const revealAll = () => reveal.forEach((el) => el.classList.add("in"));
  if ("IntersectionObserver" in window && reveal.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    reveal.forEach((el) => io.observe(el));
    // Safety net: if anything's still hidden after 2s, force it visible.
    setTimeout(() => {
      reveal.forEach((el) => {
        if (!el.classList.contains("in")) el.classList.add("in");
      });
    }, 2000);
  } else {
    revealAll();
  }

  // Generic mailto: form handler. Iterates over every field on submit and
  // builds a plain-text email body. Works for both /contact and /apply.
  // Honeypot field `website` is always treated as spam if filled.
  const form = document.querySelector("form[data-mailto-form]")
    || document.querySelector("form[data-contact]");
  if (form) {
    const status = form.querySelector("[data-status]");
    const inbox = form.dataset.inbox || "hello@collinsandgamble.com";
    const defaultSubject = form.dataset.subject || "Inquiry";

    // Optional path-coupling (only runs if both selects exist — i.e. the
    // contact form). Reshapes the "looking-for" options + placeholder
    // hints based on whether the user picked Creator / Brand / Other.
    const sideSelect = form.querySelector("#side");
    const lookingSelect = form.querySelector("#looking-for");
    const linkInput = form.querySelector("#link");
    const messageInput = form.querySelector("#message");

    if (sideSelect && lookingSelect) {
      const optionSets = {
        creator: [
          "Join the roster",
          "Already on the roster — need help",
          "Just exploring",
        ],
        brand: [
          "Single-product test campaign",
          "Multi-product / ongoing program",
          "Custom — let's talk",
          "Just exploring",
        ],
        other: [
          "General inquiry",
          "Press / media",
          "Partnership idea",
        ],
      };
      const placeholders = {
        creator: {
          link: "Your Amazon storefront URL",
          message:
            "Tell us about your storefront, your audience, and the categories you cover. " +
            "If there's a brand or product type you'd love to work with, mention it.",
        },
        brand: {
          link: "Your Amazon listing, product page, or company site",
          message:
            "Tell us about the product — ASINs if you have them, the category, " +
            "what conversion looks like today, and what you're hoping to move.",
        },
        other: {
          link: "A relevant link, if there is one",
          message: "What's on your mind?",
        },
      };
      const applySide = (side) => {
        const opts = optionSets[side] || optionSets.other;
        const previous = lookingSelect.value;
        lookingSelect.innerHTML = opts.map((o) => `<option>${o}</option>`).join("");
        if (opts.includes(previous)) lookingSelect.value = previous;
        const ph = placeholders[side] || placeholders.other;
        if (linkInput) linkInput.placeholder = ph.link;
        if (messageInput) messageInput.placeholder = ph.message;
      };
      applySide(sideSelect.value);
      sideSelect.addEventListener("change", () => applySide(sideSelect.value));
    }

    const prettify = (key) =>
      key
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    // Multi-value fields (multi-select / checkbox groups) come back as
    // multiple entries from FormData — merge them into one comma-separated
    // string per field name.
    const collect = (data) => {
      const acc = new Map();
      for (const [k, v] of data.entries()) {
        const val = v.toString().trim();
        if (!val || k === "website") continue;
        if (acc.has(k)) acc.set(k, acc.get(k) + ", " + val);
        else acc.set(k, val);
      }
      return acc;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const honeypot = (data.get("website") || "").toString().trim();
      const thanksUrl = form.dataset.thanks || "/thanks";

      const fields = collect(data);
      const fieldsObj = Object.fromEntries(fields);

      // Subject: data-subject prefix + name if we have one.
      const name = (fields.get("name") || "").trim();
      const side = (fields.get("side") || "").toLowerCase();
      const subjectPrefix =
        side === "creator" ? "Creator inquiry" :
        side === "brand"   ? "Brand inquiry"   :
        defaultSubject;

      if (status) {
        status.textContent = "Sending…";
        status.hidden = false;
      }

      // ---- Primary path: POST to the API. Server sends email via Resend.
      let delivered = false;
      try {
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: inbox,
            subjectPrefix,
            fields: fieldsObj,
            honeypot,
          }),
        });
        if (res.ok) delivered = true;
      } catch (_err) {
        // Network failed — drop through to the mailto: fallback.
      }

      if (delivered) {
        window.location.assign(thanksUrl);
        return;
      }

      // ---- Fallback: mailto:. Still routes through /thanks so the user
      // experience is identical whether the API delivered or not.

      // Honeypot — real humans never see or touch this field. In fallback
      // mode we swallow it client-side instead of generating a real email.
      if (honeypot !== "") {
        window.location.assign(thanksUrl);
        return;
      }

      const lines = [];
      for (const [k, v] of fields) {
        lines.push(`${prettify(k)}: ${v}`);
      }
      const body = lines.join("\n\n") + "\n";
      const subject = `${subjectPrefix}${name ? ` — ${name}` : ""}`;

      const href =
        `mailto:${inbox}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;

      if (status) {
        status.innerHTML =
          `Opening your email client — hit send to deliver the note. ` +
          `Redirecting in a moment…`;
      }

      // Fire the mailto: via a transient anchor so the browser hands it
      // off to the OS email client without navigating the current page.
      const a = document.createElement("a");
      a.href = href;
      a.style.display = "none";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.setTimeout(() => {
        window.location.assign(thanksUrl);
      }, 400);
    });
  }
})();
