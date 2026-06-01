/*
 * Collins & Gamble — /search page logic
 *
 * Reuses the same JSON index and scoring shape as the command palette,
 * but renders results inline on a real, URL-addressable page. Query
 * lives in the ?q= URL parameter, so a result page can be linked.
 *
 * Highlights matched substrings in the title and lead, which the
 * palette doesn't bother with — the palette's typical session is
 * sub-second and highlighting just adds visual noise. The /search
 * page is for slower, link-shareable reading.
 */
(() => {
  const root = document.querySelector("[data-search]");
  if (!root) return;

  const INDEX_URL = "/assets/data/search-index.json";
  const MAX_RESULTS = 30;

  const input = document.querySelector("[data-search-input]");
  const clear = document.querySelector("[data-search-clear]");
  const count = document.querySelector("[data-search-count]");
  const resultsEl = document.querySelector("[data-search-results]");
  const emptyEl = document.querySelector("[data-search-empty]");
  const suggestEl = document.querySelector("[data-search-suggestions]");

  const state = { items: [], query: "" };

  // ----- Index ----------------------------------------------------------
  async function loadIndex() {
    try {
      const res = await fetch(INDEX_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error("index fetch failed");
      const data = await res.json();
      state.items = Array.isArray(data.items) ? data.items : [];
    } catch (_) {
      state.items = [];
    }
  }

  // ----- Scoring (shape-compatible with palette) ------------------------
  function tokenize(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  function scoreItem(item, qLower, tokens) {
    if (!qLower) return 0;
    let score = 0;
    const title = (item.title || "").toLowerCase();
    const parent = (item.parent || "").toLowerCase();
    const desc = (item.description || "").toLowerCase();
    const lead = (item.lead || "").toLowerCase();
    const tags = (item.tags || []).map((t) => t.toLowerCase());
    if (title === qLower) score += 200;
    if (title.startsWith(qLower)) score += 90;
    if (title.includes(qLower)) score += 50;
    if (parent.includes(qLower)) score += 25;
    if (lead.includes(qLower)) score += 15;
    if (desc.includes(qLower)) score += 10;
    if (tags.includes(qLower)) score += 40;
    for (const tok of tokens) {
      if (tok.length < 2) continue;
      if (title.includes(tok)) score += 8;
      if (parent.includes(tok)) score += 4;
      if (lead.includes(tok)) score += 3;
      if (desc.includes(tok)) score += 2;
      if (tags.some((t) => t.includes(tok))) score += 6;
    }
    const kindBoost = { page: 5, action: 7, article: 4, section: 2, topic: 3 };
    if (score > 0) score += kindBoost[item.kind] || 0;
    return score;
  }

  function search(query) {
    const q = (query || "").trim();
    if (!q) return [];
    const qLower = q.toLowerCase();
    const tokens = tokenize(q);
    const scored = [];
    for (const item of state.items) {
      const s = scoreItem(item, qLower, tokens);
      if (s > 0) scored.push({ item, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_RESULTS);
  }

  // ----- Highlight ------------------------------------------------------
  function highlight(text, terms) {
    if (!text) return "";
    const esc = (s) => s.replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
    if (!terms || terms.length === 0) return esc(text);
    const escaped = esc(text);
    let out = escaped;
    // Sort terms by length descending so longer matches win
    const sorted = [...new Set(terms)].sort((a, b) => b.length - a.length);
    for (const term of sorted) {
      if (term.length < 2) continue;
      const re = new RegExp(
        `(${term.replace(/[.*+?^${}()|[\\\]\\\\]/g, "\\$&")})`,
        "gi"
      );
      out = out.replace(re, "<mark>$1</mark>");
    }
    return out;
  }

  // ----- Rendering ------------------------------------------------------
  const KIND_LABEL = {
    page: "Page",
    section: "Section",
    article: "Article",
    topic: "Topic",
    action: "Action",
  };

  function renderResultsList(results, query) {
    const terms = query.trim()
      ? [query.trim(), ...tokenize(query)].filter((t) => t.length >= 2)
      : [];
    const html = results
      .map(({ item }) => {
        const titleHTML = highlight(item.title, terms);
        const leadHTML = highlight(item.lead || item.description || "", terms);
        const parent = item.parent
          ? `<span class="search-result-parent">${highlight(item.parent, terms)} ·</span> `
          : "";
        const kind = KIND_LABEL[item.kind] || "Page";
        return `
          <li class="search-result">
            <a class="search-result-link" href="${item.url}">
              <span class="search-result-kind">${kind}</span>
              <h2 class="search-result-title">${parent}${titleHTML}</h2>
              <p class="search-result-lead">${leadHTML}</p>
              <span class="search-result-url">${item.url}</span>
            </a>
          </li>
        `;
      })
      .join("");
    resultsEl.innerHTML = `<ul class="search-result-list">${html}</ul>`;
  }

  function setEmpty(query) {
    resultsEl.innerHTML = "";
    emptyEl.hidden = !query;
    suggestEl.hidden = !!query;
  }

  function render() {
    const q = state.query.trim();
    if (!q) {
      setEmpty("");
      count.textContent = "";
      clear.hidden = true;
      return;
    }
    clear.hidden = false;
    suggestEl.hidden = true;
    const results = search(q);
    if (results.length === 0) {
      setEmpty(q);
      count.textContent = `No results for "${q}"`;
      return;
    }
    emptyEl.hidden = true;
    count.textContent = `${results.length} ${results.length === 1 ? "result" : "results"} for "${q}"`;
    renderResultsList(results, q);
  }

  // ----- URL syncing ----------------------------------------------------
  function updateUrl(q) {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url);
  }

  function readQueryFromUrl() {
    const url = new URL(window.location.href);
    return url.searchParams.get("q") || "";
  }

  // ----- Wiring ---------------------------------------------------------
  let debounceTimer = null;
  function onInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.query = input.value;
      updateUrl(state.query);
      render();
    }, 80);
  }

  function setQuery(q) {
    input.value = q;
    state.query = q;
    updateUrl(q);
    render();
    input.focus();
  }

  // ----- Init -----------------------------------------------------------
  async function init() {
    await loadIndex();
    const initial = readQueryFromUrl();
    if (initial) {
      input.value = initial;
      state.query = initial;
    }
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && input.value) {
        e.preventDefault();
        setQuery("");
      }
    });
    clear.addEventListener("click", (e) => {
      e.preventDefault();
      setQuery("");
    });
    // Suggestion chips both in empty state and start-here block
    document.querySelectorAll("[data-search-suggest]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        setQuery(btn.dataset.searchSuggest);
      });
    });
    render();
    // Focus the input on landing if we don't have an initial query (so the
    // user can just start typing). Skip if URL had a query so the page can
    // be linked-to without ambushing the user's scroll position.
    if (!initial) {
      // Use a small delay so reveal animations don't fight us
      setTimeout(() => input.focus(), 350);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
