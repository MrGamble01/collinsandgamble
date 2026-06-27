/*
 * Collins & Gamble — Brief Builder (/brief)
 *
 * Live two-way binding between the form on the left and the printable
 * brief document on the right. Persists draft to localStorage so the
 * page survives a refresh or accidental close.
 *
 * Plain-text export and print-to-PDF are the deliverables. No PDF
 * library — the browser's "Print" → "Save as PDF" produces a perfectly
 * clean document with the print stylesheet, no extra dependency.
 */
(() => {
  const root = document.querySelector("[data-brief]");
  if (!root) return;

  const STORAGE_KEY = "cg:brief:draft:v1";

  const form = root.querySelector("[data-brief-form]");
  const doc = root.querySelector("[data-brief-doc]");
  const savedFlag = root.querySelector("[data-brief-saved]");
  const copyBtn = root.querySelector("[data-brief-copy]");
  const printBtn = root.querySelector("[data-brief-print]");
  const resetBtn = root.querySelector("[data-brief-reset]");

  const inputs = Array.from(form.querySelectorAll("[data-key]"));

  // ---------- Persist ---------------------------------------------------
  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (_) {
      return {};
    }
  }
  function saveDraft(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      flashSaved();
    } catch (_) {
      // localStorage may be unavailable (private mode); silent.
    }
  }
  function clearDraft() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  let savedTimer = null;
  function flashSaved() {
    if (!savedFlag) return;
    savedFlag.hidden = false;
    savedFlag.classList.add("is-visible");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      savedFlag.classList.remove("is-visible");
      setTimeout(() => { savedFlag.hidden = true; }, 220);
    }, 1500);
  }

  // ---------- Read form -------------------------------------------------
  function readForm() {
    const data = {};
    for (const el of inputs) {
      const key = el.dataset.key;
      if (!key) continue;
      const v = (el.value || "").trim();
      if (v) data[key] = v;
    }
    return data;
  }

  // ---------- Render the live brief doc --------------------------------
  function listify(text) {
    if (!text) return [];
    return text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function setText(el, value, placeholder) {
    if (!el) return;
    const v = (value || "").trim();
    if (v) {
      el.textContent = v;
      el.classList.remove("is-placeholder");
    } else if (placeholder !== undefined) {
      el.textContent = placeholder;
      el.classList.add("is-placeholder");
    }
  }

  function renderList(listEl, items, placeholder, ordered) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (items.length === 0) {
      const li = document.createElement("li");
      li.className = "brief-doc-placeholder";
      li.textContent = placeholder;
      listEl.appendChild(li);
      return;
    }
    for (const text of items) {
      const li = document.createElement("li");
      li.textContent = text;
      listEl.appendChild(li);
    }
  }

  function renderTitle(data) {
    const t = doc.querySelector("[data-doc-title]");
    const s = doc.querySelector("[data-doc-sub]");
    const product = data.product || "";
    const brand = data.brand || "";
    if (t) t.textContent = product || "The product";
    if (s) {
      if (brand && product) s.textContent = `by ${brand}`;
      else if (brand) s.textContent = `by ${brand}`;
      else s.textContent = "by the brand";
    }
  }

  function renderMeta(data) {
    const m = doc.querySelector("[data-doc-meta]");
    if (!m) return;
    const parts = [];
    if (data.asin) parts.push(`ASIN / link: ${data.asin}`);
    if (data.due) parts.push(`Due: ${data.due}`);
    if (data.signoff) parts.push(`Signoff: ${data.signoff}`);
    if (parts.length === 0) {
      m.hidden = true;
      m.textContent = "";
    } else {
      m.hidden = false;
      m.textContent = parts.join("  ·  ");
    }
  }

  function render() {
    const data = readForm();
    renderTitle(data);
    renderMeta(data);
    setText(
      doc.querySelector("[data-doc-description]"),
      data.description,
      "Add a one-sentence description in section 01 and it'll show up here."
    );
    setText(
      doc.querySelector("[data-doc-audience]"),
      data.audience,
      "Describe the actual user in section 02 — by context, not demographic."
    );
    const features = [data.feat1, data.feat2, data.feat3].filter((s) => s && s.trim());
    renderList(
      doc.querySelector("[data-doc-features]"),
      features,
      "Add the three features in section 03."
    );
    renderList(
      doc.querySelector("[data-doc-truths]"),
      listify(data.truths),
      "Add verifiable facts in section 04 (one per line)."
    );
    renderList(
      doc.querySelector("[data-doc-avoid]"),
      listify(data.avoid),
      "Add out-of-bounds claims in section 05 (one per line)."
    );
    saveDraft(data);
  }

  // ---------- Plain-text export ----------------------------------------
  function toPlainText() {
    const d = readForm();
    const lines = [];
    const rule = "─".repeat(56);
    const brand = d.brand || "the brand";
    const product = d.product || "the product";
    lines.push(`CREATOR BRIEF — ${product}`);
    lines.push(`by ${brand}`);
    if (d.due || d.signoff || d.asin) {
      const meta = [
        d.asin ? `ASIN / link: ${d.asin}` : null,
        d.due ? `Due: ${d.due}` : null,
        d.signoff ? `Signoff: ${d.signoff}` : null,
      ].filter(Boolean).join("  ·  ");
      lines.push(meta);
    }
    lines.push(rule);
    lines.push("");
    lines.push("01  WHAT THIS IS");
    lines.push(d.description || "(not yet filled in)");
    lines.push("");
    lines.push("02  WHO IT'S FOR");
    lines.push(d.audience || "(not yet filled in)");
    lines.push("");
    lines.push("03  THREE FEATURES THAT MATTER");
    const feats = [d.feat1, d.feat2, d.feat3].filter(Boolean);
    if (feats.length) feats.forEach((f, i) => lines.push(`  ${i + 1}.  ${f}`));
    else lines.push("(not yet filled in)");
    lines.push("");
    lines.push("04  WORTH MENTIONING, IF IT FITS");
    const truths = listify(d.truths);
    if (truths.length) truths.forEach((t) => lines.push(`  •  ${t}`));
    else lines.push("(not yet filled in)");
    lines.push("");
    lines.push("05  WHAT NOT TO CLAIM");
    const avoid = listify(d.avoid);
    if (avoid.length) avoid.forEach((a) => lines.push(`  ✗  ${a}`));
    else lines.push("(not yet filled in)");
    lines.push("");
    lines.push(rule);
    lines.push("");
    lines.push("This brief follows the Collins & Gamble five-section");
    lines.push("structure. You're free to use it with any creator, including");
    lines.push("ones we don't represent. The point is that the creator knows");
    lines.push("what's true, what matters, and what to avoid — and then");
    lines.push("films in their own voice.");
    lines.push("");
    lines.push("collinsandgamble.com/brief");
    return lines.join("\n");
  }

  // ---------- Copy & Print ---------------------------------------------
  async function copyToClipboard() {
    const text = toPlainText();
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (_) { /* fall through */ }
    if (!ok) {
      // Fallback: hidden textarea + execCommand
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); ok = true; } catch (_) {}
      document.body.removeChild(ta);
    }
    flashButton(copyBtn, ok ? "Copied" : "Couldn't copy");
  }

  function flashButton(btn, label) {
    if (!btn) return;
    const span = btn.querySelector("span");
    if (!span) return;
    const old = span.textContent;
    span.textContent = label;
    btn.classList.add("is-flash");
    setTimeout(() => {
      span.textContent = old;
      btn.classList.remove("is-flash");
    }, 1400);
  }

  function printDoc() {
    document.documentElement.classList.add("printing-brief");
    // Let the class apply, then print on next frame.
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => {
        document.documentElement.classList.remove("printing-brief");
      }, 500);
    });
  }

  // ---------- Reset -----------------------------------------------------
  function reset() {
    if (!confirm("Clear the form and start over?")) return;
    for (const el of inputs) el.value = "";
    clearDraft();
    render();
  }

  // ---------- Init ------------------------------------------------------
  function init() {
    // Hydrate from localStorage
    const saved = loadDraft();
    for (const el of inputs) {
      const key = el.dataset.key;
      if (key && saved[key]) el.value = saved[key];
    }

    // Wire input events (debounced render to keep typing smooth)
    let renderTimer = null;
    const schedule = () => {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(render, 60);
    };
    form.addEventListener("input", schedule);

    if (copyBtn) copyBtn.addEventListener("click", copyToClipboard);
    if (printBtn) printBtn.addEventListener("click", printDoc);
    if (resetBtn) resetBtn.addEventListener("click", reset);

    // Ctrl/⌘ + P → use our pretty print path
    document.addEventListener("keydown", (e) => {
      const isMeta = /Mac|iPhone|iPad/i.test(navigator.platform) ? e.metaKey : e.ctrlKey;
      if (isMeta && (e.key === "p" || e.key === "P")) {
        // Only on this page — and only if focus isn't in an input that
        // might want default behavior. We override either way; the
        // print stylesheet renders the brief regardless of focus.
        e.preventDefault();
        printDoc();
      }
    });

    render();
  }

  init();
})();
