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

  const form = document.querySelector("form[data-contact]");
  if (form) {
    const status = form.querySelector("[data-status]");
    const inbox = "hello@collinsandgamble.com";

    // Couple "I'm a..." with the rest of the form so the path the user
    // picked actually shapes the options and placeholders they see.
    const sideSelect = form.querySelector("#side");
    const lookingSelect = form.querySelector("#looking-for");
    const linkInput = form.querySelector("#link");
    const messageInput = form.querySelector("#message");

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
      if (lookingSelect) {
        const previous = lookingSelect.value;
        lookingSelect.innerHTML = opts
          .map((o) => `<option>${o}</option>`)
          .join("");
        if (opts.includes(previous)) lookingSelect.value = previous;
      }
      const ph = placeholders[side] || placeholders.other;
      if (linkInput) linkInput.placeholder = ph.link;
      if (messageInput) messageInput.placeholder = ph.message;
    };

    if (sideSelect) {
      applySide(sideSelect.value);
      sideSelect.addEventListener("change", () => applySide(sideSelect.value));
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const side = (data.get("side") || "other").toString();
      const name = (data.get("name") || "").toString().trim();
      const email = (data.get("email") || "").toString().trim();
      const link = (data.get("link") || "").toString().trim();
      const looking = (data.get("looking-for") || "").toString().trim();
      const message = (data.get("message") || "").toString().trim();

      const subjectPrefix =
        side === "creator" ? "Creator inquiry" :
        side === "brand"   ? "Brand inquiry"   :
                             "Inquiry";
      const subject = `${subjectPrefix}${name ? ` — ${name}` : ""}`;

      const body =
`I'm a: ${side}
Name: ${name}
Email: ${email}
Link: ${link}
Looking for: ${looking}

${message}
`;

      const href =
        `mailto:${inbox}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;

      if (status) {
        status.innerHTML =
          `Opening your email client with this message pre-filled — just hit send. ` +
          `If nothing opens, write us directly at ` +
          `<a href="mailto:${inbox}" style="text-decoration: underline;">${inbox}</a>.`;
        status.hidden = false;
      }

      window.location.href = href;
    });
  }
})();
