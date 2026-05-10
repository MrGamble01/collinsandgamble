(() => {
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
  } else {
    reveal.forEach((el) => el.classList.add("in"));
  }

  const form = document.querySelector("form[data-contact]");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const status = form.querySelector("[data-status]");
      if (status) {
        status.textContent =
          "Thanks — your message is queued. We'll be in touch within one business day.";
        status.hidden = false;
      }
      form.reset();
    });
  }
})();
