(() => {
  const root = document.querySelector("[data-quiz]");
  if (!root) return;

  const QUESTIONS = [
    {
      q: "Are you approved on the Amazon Influencer Program?",
      help: "An active AIP storefront is the one hard requirement. We can't speed up Amazon's approval.",
      options: [
        { label: "Yes — my storefront is live", points: 2 },
        { label: "I've applied, still waiting to hear", points: 0, gate: true },
        { label: "Not yet, or I'm not sure what that is", points: 0, gate: true },
      ],
    },
    {
      q: "How often do on-site reviews go up on your storefront?",
      help: "The on-site review video is the engine. Cadence matters more than follower count.",
      options: [
        { label: "Most weeks — I keep it active", points: 2 },
        { label: "A few times a month", points: 1 },
        { label: "Rarely, or I haven't kept it going", points: 0 },
      ],
    },
    {
      q: "How does your audience actually behave?",
      help: "We care more about people who watch and buy than a big number that doesn't.",
      options: [
        { label: "They watch my reviews and they buy", points: 2 },
        { label: "Decent reach, but engagement varies", points: 1 },
        { label: "Still small, or just starting out", points: 0 },
      ],
    },
    {
      q: "What do your storefront commissions look like?",
      help: "A storefront already earning something tells us the fundamentals work.",
      options: [
        { label: "Steady and growing month to month", points: 2 },
        { label: "Some income, but inconsistent", points: 1 },
        { label: "Little to nothing so far", points: 0 },
      ],
    },
    {
      q: "How do you feel about unscripted, honest reviews?",
      help: "Our entire model is the real take. No brand gets script approval.",
      options: [
        { label: "I film what I actually think — always", points: 2 },
        { label: "Usually, though it depends on the brand", points: 1 },
        { label: "I'd rather follow approved talking points", points: 0, misfit: true },
      ],
    },
  ];

  const VERDICTS = {
    gated: {
      tier: null,
      eyebrow: "Start with Amazon",
      title: "First, get into the program.",
      body: "Everything we do sits on top of an approved Amazon Influencer storefront. We can't accelerate Amazon's approval — but the Playbook explains exactly how the program works, so you're ready the moment you're in.",
      primary: { label: "Read the Playbook", href: "/playbook" },
      secondary: null,
    },
    misfit: {
      tier: null,
      eyebrow: "Maybe not us",
      title: "We might not be your agency.",
      body: "Our whole model is honest, unscripted reviews — no brand gets script approval, and shoppers can tell the difference. If approved talking points matter to you, a different agency will serve you better. That's an honest no, not a knock.",
      primary: { label: "Read the Playbook", href: "/playbook" },
      secondary: { label: "Actually — apply anyway", href: "/apply" },
    },
    strong: {
      tier: "strong",
      eyebrow: "Strong fit",
      title: "You're who we built this for.",
      body: "Approved, active, honest, and already converting — that's the profile. We'd genuinely like to see your application, and we read every one personally.",
      primary: { label: "Apply to the roster", href: "/apply" },
      secondary: null,
    },
    close: {
      tier: "close",
      eyebrow: "Close",
      title: "You're close. Worth a conversation.",
      body: "Some of the pieces are already there. The roster stays small, so we're selective — but “not the biggest numbers yet” has never been a dealbreaker if the storefront and the honesty are real. Apply, and tell us where you're headed.",
      primary: { label: "Apply anyway", href: "/apply" },
      secondary: { label: "Or read the Playbook first", href: "/playbook" },
    },
    early: {
      tier: "early",
      eyebrow: "Not yet",
      title: "Not yet — and that's an honest answer.",
      body: "The foundation isn't quite there to make the most of what we do. Build the storefront, get a review cadence going, let the commissions start to show up. The Playbook is the exact map. Come back when it's working.",
      primary: { label: "Read the Playbook", href: "/playbook" },
      secondary: null,
    },
  };

  const answers = [];
  let current = 0;

  const progressFill = root.querySelector("[data-progress]");
  const stepLabel = root.querySelector("[data-step]");
  const qEl = root.querySelector("[data-question]");
  const helpEl = root.querySelector("[data-help]");
  const optionsEl = root.querySelector("[data-options]");
  const quizPanel = root.querySelector("[data-panel='quiz']");
  const resultPanel = root.querySelector("[data-panel='result']");
  const backBtn = root.querySelector("[data-back]");
  const liveRegion = root.querySelector("[data-live]");

  const ARROW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';

  function renderQuestion() {
    const q = QUESTIONS[current];
    progressFill.style.width = (current / QUESTIONS.length) * 100 + "%";
    stepLabel.textContent = `Question ${current + 1} of ${QUESTIONS.length}`;
    qEl.textContent = q.q;
    helpEl.textContent = q.help;
    optionsEl.innerHTML = "";
    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      if (answers[current] === opt) btn.classList.add("selected");
      btn.innerHTML = `<span>${opt.label}</span>${ARROW}`;
      btn.addEventListener("click", () => choose(opt));
      optionsEl.appendChild(btn);
    });
    backBtn.hidden = current === 0;
    if (liveRegion) liveRegion.textContent = `Question ${current + 1} of ${QUESTIONS.length}: ${q.q}`;
    const focusTarget = optionsEl.querySelector(".quiz-option.selected") || optionsEl.querySelector(".quiz-option");
    if (focusTarget) focusTarget.focus();
  }

  function choose(opt) {
    answers[current] = opt;
    if (current < QUESTIONS.length - 1) {
      current++;
      renderQuestion();
    } else {
      showResult();
    }
  }

  function back() {
    if (current > 0) {
      current--;
      renderQuestion();
    }
  }

  function computeVerdict() {
    if (answers[0] && answers[0].gate) return VERDICTS.gated;
    if (answers.some((a) => a && a.misfit)) return VERDICTS.misfit;
    const score = answers.reduce((s, a) => s + (a ? a.points : 0), 0);
    if (score >= 8) return VERDICTS.strong;
    if (score >= 5) return VERDICTS.close;
    return VERDICTS.early;
  }

  function showResult() {
    progressFill.style.width = "100%";
    const v = computeVerdict();

    resultPanel.querySelector("[data-result-eyebrow]").textContent = v.eyebrow;
    resultPanel.querySelector("[data-result-title]").textContent = v.title;
    resultPanel.querySelector("[data-result-body]").textContent = v.body;

    // Signal meter — only for scored verdicts
    const meter = resultPanel.querySelector("[data-meter]");
    if (v.tier) {
      meter.hidden = false;
      meter.querySelectorAll("[data-seg]").forEach((seg) => {
        seg.classList.toggle("active", seg.dataset.seg === v.tier);
      });
    } else {
      meter.hidden = true;
    }

    const primary = resultPanel.querySelector("[data-result-primary]");
    primary.textContent = v.primary.label;
    primary.setAttribute("href", v.primary.href);
    primary.insertAdjacentHTML("beforeend", ARROW);

    const secondary = resultPanel.querySelector("[data-result-secondary]");
    if (v.secondary) {
      secondary.hidden = false;
      secondary.textContent = v.secondary.label;
      secondary.setAttribute("href", v.secondary.href);
    } else {
      secondary.hidden = true;
    }

    quizPanel.hidden = true;
    resultPanel.hidden = false;
    if (liveRegion) liveRegion.textContent = `Result: ${v.title}`;
    const h = resultPanel.querySelector("[data-result-title]");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
  }

  function restart() {
    answers.length = 0;
    current = 0;
    resultPanel.hidden = true;
    quizPanel.hidden = false;
    renderQuestion();
  }

  backBtn.addEventListener("click", back);
  root.querySelector("[data-restart]").addEventListener("click", restart);

  // Replace the no-JS fallback with the live quiz.
  const fallback = root.querySelector("[data-fallback]");
  if (fallback) fallback.hidden = true;
  quizPanel.hidden = false;
  renderQuestion();
})();
