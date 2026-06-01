/*
 * Collins & Gamble — Command Palette
 *
 * Site-wide search and quick actions. Opens on ⌘K / Ctrl K from any
 * page, or via the trigger button injected into the navbar. Loads the
 * search index lazily on first open. Keyboard-first; mouse works too.
 *
 * Public surface: a single self-mounting IIFE. No globals leak.
 *
 * Index shape (assets/data/search-index.json):
 *   { version: number, items: Item[] }
 *   Item: { id, title, url, kind, parent?, lead, description, tags[] }
 *
 * Kinds we render:
 *   page      — top-level page
 *   section   — anchored section within a page
 *   article   — journal article
 *   topic     — cross-cutting topic
 *   action    — quick action (book, email, apply, etc.)
 */
(() => {
  const INDEX_URL = "/assets/data/search-index.json";
  const RECENT_KEY = "cg:palette:recent";
  const MAX_RECENT = 4;
  const MAX_RESULTS = 8;

  // ---- State -----------------------------------------------------------
  const state = {
    open: false,
    loading: false,
    loaded: false,
    items: /** @type {Item[]} */ ([]),
    query: "",
    results: /** @type {ScoredItem[]} */ ([]),
    selected: 0,
    showShortcuts: false,
  };

  // ---- Mount once, even if script loads multiple times ----------------
  if (window.__cgPaletteMounted) return;
  window.__cgPaletteMounted = true;

  // SVG icons shared by trigger + results
  const ICONS = {
    search:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    arrowRight:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
    arrowUp:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    arrowDown:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
    enter:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 4v7a3 3 0 0 1-3 3H5M5 14l4-4M5 14l4 4"/></svg>',
    esc:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    page:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    section:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    article:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 3H8a2 2 0 0 0-2 2v14l5-3 5 3 5-3V5a2 2 0 0 0-2-2z"/></svg>',
    topic:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 0-16 0c0 4.4 8 10 8 10s8-5.6 8-10z"/><circle cx="12" cy="12" r="3"/></svg>',
    action:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
    recent:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    help:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .8-1 1.7"/><circle cx="12" cy="16.5" r="0.7" fill="currentColor"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  const KIND_LABEL = {
    page: "Page",
    section: "Section",
    article: "Article",
    topic: "Topic",
    action: "Action",
  };

  // ---- Detect platform for shortcut hint ------------------------------
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
  const META_LABEL = isMac ? "⌘" : "Ctrl";

  // ---- Trigger button (injected into nav) -----------------------------
  function injectTrigger() {
    const nav = document.querySelector(".nav-links");
    if (!nav) return;
    if (nav.querySelector("[data-palette-trigger]")) return;

    const li = document.createElement("li");
    li.className = "nav-search-wrap";
    li.innerHTML = `
      <button type="button" data-palette-trigger class="nav-search"
              aria-label="Open search (${META_LABEL} K)">
        ${ICONS.search}
        <span>Search</span>
        <kbd>${META_LABEL} K</kbd>
      </button>
    `;
    const ctaWrap = nav.querySelector(".nav-cta-wrap");
    if (ctaWrap) nav.insertBefore(li, ctaWrap);
    else nav.appendChild(li);

    li.querySelector("button").addEventListener("click", open);
  }

  // ---- DOM construction -----------------------------------------------
  let dom = null;

  function buildDOM() {
    if (dom) return dom;

    const root = document.createElement("div");
    root.className = "cg-palette";
    root.setAttribute("hidden", "");
    root.innerHTML = `
      <div class="cg-palette-backdrop" data-close></div>
      <div class="cg-palette-window" role="dialog" aria-label="Search Collins and Gamble" aria-modal="true">
        <div class="cg-palette-header">
          <span class="cg-palette-icon" aria-hidden="true">${ICONS.search}</span>
          <input
            type="search"
            class="cg-palette-input"
            placeholder="Search pages, articles, sections, actions…"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            role="combobox"
            aria-controls="cg-palette-list"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-activedescendant=""
            data-input
          />
          <button type="button" class="cg-palette-shortcut-toggle" data-shortcut-toggle aria-label="Show keyboard shortcuts">
            ${ICONS.help}
          </button>
          <button type="button" class="cg-palette-close" data-close aria-label="Close (Escape)">
            ${ICONS.close}
          </button>
        </div>

        <div class="cg-palette-body">
          <ul id="cg-palette-list" class="cg-palette-list" role="listbox" data-list></ul>
          <div class="cg-palette-empty" data-empty hidden>
            <div class="cg-palette-empty-mark" aria-hidden="true">${ICONS.search}</div>
            <p class="cg-palette-empty-title">No matches.</p>
            <p class="cg-palette-empty-sub">Try a topic — "storefront", "script", "approval" — or hit ${META_LABEL}&nbsp;K for shortcuts.</p>
          </div>
          <div class="cg-palette-shortcuts" data-shortcuts hidden>
            <h3>Keyboard shortcuts</h3>
            <dl>
              <div><dt><kbd>${META_LABEL}</kbd><kbd>K</kbd></dt><dd>Open or close the palette from anywhere</dd></div>
              <div><dt><kbd>↑</kbd><kbd>↓</kbd></dt><dd>Move through the results</dd></div>
              <div><dt><kbd>↵</kbd></dt><dd>Open the selected result</dd></div>
              <div><dt><kbd>${META_LABEL}</kbd><kbd>↵</kbd></dt><dd>Open the result in a new tab</dd></div>
              <div><dt><kbd>Esc</kbd></dt><dd>Close the palette</dd></div>
              <div><dt><kbd>?</kbd></dt><dd>Toggle this shortcuts view</dd></div>
              <div><dt><kbd>Tab</kbd></dt><dd>Move focus through controls</dd></div>
            </dl>
            <h3 style="margin-top: 1.5rem;">Quick navigation</h3>
            <p class="cg-palette-shortcuts-sub">
              Anywhere outside an input, press <kbd>g</kbd> then one letter
              to jump straight to a section.
            </p>
            <dl>
              <div><dt><kbd>g</kbd><kbd>h</kbd></dt><dd>Home</dd></div>
              <div><dt><kbd>g</kbd><kbd>p</kbd></dt><dd>Playbook</dd></div>
              <div><dt><kbd>g</kbd><kbd>j</kbd></dt><dd>Journal</dd></div>
              <div><dt><kbd>g</kbd><kbd>a</kbd></dt><dd>Apply (creators)</dd></div>
              <div><dt><kbd>g</kbd><kbd>b</kbd></dt><dd>Brands</dd></div>
              <div><dt><kbd>g</kbd><kbd>s</kbd></dt><dd>How it works</dd></div>
              <div><dt><kbd>g</kbd><kbd>k</kbd></dt><dd>Fit check</dd></div>
              <div><dt><kbd>g</kbd><kbd>c</kbd></dt><dd>Contact</dd></div>
              <div><dt><kbd>g</kbd><kbd>o</kbd></dt><dd>About</dd></div>
              <div><dt><kbd>g</kbd><kbd>r</kbd></dt><dd>Search page</dd></div>
            </dl>
            <p class="cg-palette-shortcuts-note">
              Nothing here is stored on a server. Recent searches live in
              your browser only.
            </p>
          </div>
        </div>

        <div class="cg-palette-footer">
          <div class="cg-palette-footer-keys">
            <span><kbd>${ICONS.arrowUp}</kbd><kbd>${ICONS.arrowDown}</kbd> Navigate</span>
            <span><kbd>${ICONS.enter}</kbd> Select</span>
            <span><kbd>esc</kbd> Close</span>
          </div>
          <div class="cg-palette-footer-brand">
            <span class="cg-palette-footer-mark">C<span class="amp">&amp;</span>G</span>
            Search
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    // Wire interactions
    root.querySelectorAll("[data-close]").forEach((el) =>
      el.addEventListener("click", close)
    );
    root.querySelector("[data-shortcut-toggle]").addEventListener("click", toggleShortcuts);
    const input = root.querySelector("[data-input]");
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onInputKey);
    root.querySelector("[data-list]").addEventListener("mousemove", onListHover);
    root.querySelector("[data-list]").addEventListener("click", onListClick);

    dom = {
      root,
      input,
      list: root.querySelector("[data-list]"),
      empty: root.querySelector("[data-empty]"),
      shortcuts: root.querySelector("[data-shortcuts]"),
      body: root.querySelector(".cg-palette-body"),
    };
    return dom;
  }

  // ---- Index loading ---------------------------------------------------
  async function loadIndex() {
    if (state.loaded || state.loading) return;
    state.loading = true;
    try {
      const res = await fetch(INDEX_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error("index fetch failed");
      const data = await res.json();
      state.items = Array.isArray(data.items) ? data.items : [];
      state.loaded = true;
    } catch (err) {
      // If the index can't load, fall back to a minimal in-memory list
      // so the palette still does something useful.
      state.items = FALLBACK_ITEMS;
      state.loaded = true;
    } finally {
      state.loading = false;
    }
  }

  // Minimal fallback so the palette doesn't fully break if the JSON
  // index 404s or the user is offline after first paint.
  const FALLBACK_ITEMS = [
    { id: "home", title: "Home", url: "/", kind: "page", lead: "", description: "", tags: ["home"] },
    { id: "playbook", title: "The Playbook", url: "/playbook", kind: "page", lead: "", description: "", tags: ["playbook"] },
    { id: "journal", title: "The Journal", url: "/journal", kind: "page", lead: "", description: "", tags: ["journal"] },
    { id: "apply", title: "Apply", url: "/apply", kind: "action", lead: "", description: "", tags: ["apply"] },
    { id: "brands", title: "For brands", url: "/brands", kind: "action", lead: "", description: "", tags: ["brands"] },
    { id: "contact", title: "Contact", url: "/contact", kind: "page", lead: "", description: "", tags: ["contact"] },
  ];

  // ---- Scoring ---------------------------------------------------------
  // Lightweight token-based scorer. Not as good as a real fuzzy matcher
  // but easier to reason about, predictable, and ~free per keystroke.
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

    // Strong: exact title match
    if (title === qLower) score += 200;
    // Strong: title startsWith query
    if (title.startsWith(qLower)) score += 90;
    // Solid: substring in title
    if (title.includes(qLower)) score += 50;
    // Medium: substring in parent or lead or description
    if (parent.includes(qLower)) score += 25;
    if (lead.includes(qLower)) score += 15;
    if (desc.includes(qLower)) score += 10;
    // Tag exact match
    if (tags.includes(qLower)) score += 40;

    // Per-token bonuses (multi-word queries)
    for (const tok of tokens) {
      if (tok.length < 2) continue;
      if (title.includes(tok)) score += 8;
      if (parent.includes(tok)) score += 4;
      if (lead.includes(tok)) score += 3;
      if (desc.includes(tok)) score += 2;
      if (tags.some((t) => t.includes(tok))) score += 6;
    }

    // Kind weights — pages and actions rank a touch higher than sections
    // for short queries, where the user usually wants the top destination
    const kindBoost = {
      page: 5,
      action: 7,
      article: 4,
      section: 2,
      topic: 3,
    };
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

  // ---- Rendering -------------------------------------------------------
  function renderItemRow(item, index, selected, isRecent) {
    const id = `cg-palette-opt-${index}`;
    const kind = item.kind || "page";
    const icon = isRecent ? ICONS.recent : (ICONS[kind] || ICONS.page);
    const label = KIND_LABEL[kind] || "Page";
    const parent = item.parent ? `<span class="cg-palette-row-parent">${escapeHTML(item.parent)} ·</span>` : "";
    const lead = item.lead ? `<span class="cg-palette-row-lead">${escapeHTML(item.lead)}</span>` : "";
    return `
      <li
        id="${id}"
        class="cg-palette-row${selected ? " is-selected" : ""}"
        role="option"
        aria-selected="${selected ? "true" : "false"}"
        data-index="${index}"
        data-url="${escapeAttr(item.url)}">
        <span class="cg-palette-row-icon">${icon}</span>
        <span class="cg-palette-row-text">
          <span class="cg-palette-row-title">
            ${parent}${escapeHTML(item.title)}
          </span>
          ${lead}
        </span>
        <span class="cg-palette-row-kind">${label}</span>
        <span class="cg-palette-row-arrow" aria-hidden="true">${ICONS.arrowRight}</span>
      </li>
    `;
  }

  function escapeHTML(s) {
    return (s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }
  function escapeAttr(s) {
    return (s || "").replace(/"/g, "&quot;");
  }

  function render() {
    const { list, empty, shortcuts, input } = dom;
    // Shortcuts panel overrides everything else
    if (state.showShortcuts) {
      list.hidden = true;
      empty.hidden = true;
      shortcuts.hidden = false;
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-activedescendant", "");
      return;
    }

    shortcuts.hidden = true;
    if (!state.query) {
      // Empty state — show recent + quick actions
      const recent = loadRecent();
      const quick = state.items.filter((i) => i.kind === "action").slice(0, 4);
      const items = [...recent, ...quick];
      list.hidden = items.length === 0;
      empty.hidden = items.length !== 0;
      if (items.length === 0) {
        input.setAttribute("aria-activedescendant", "");
        input.setAttribute("aria-expanded", "false");
        list.innerHTML = "";
        return;
      }
      input.setAttribute("aria-expanded", "true");
      const html = [];
      if (recent.length) {
        html.push(`<li class="cg-palette-group" role="presentation">Recent</li>`);
        for (let i = 0; i < recent.length; i++) {
          html.push(renderItemRow(recent[i], i, i === state.selected, true));
        }
      }
      if (quick.length) {
        html.push(`<li class="cg-palette-group" role="presentation">Quick actions</li>`);
        for (let i = 0; i < quick.length; i++) {
          const idx = recent.length + i;
          html.push(renderItemRow(quick[i], idx, idx === state.selected, false));
        }
      }
      list.innerHTML = html.join("");
      state.results = items.map((item) => ({ item, score: 0 }));
      updateActiveDescendant();
      return;
    }

    // Has query — show search results
    state.results = search(state.query);
    if (state.selected >= state.results.length) state.selected = 0;
    if (state.results.length === 0) {
      list.hidden = true;
      empty.hidden = false;
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-activedescendant", "");
      return;
    }
    list.hidden = false;
    empty.hidden = true;
    input.setAttribute("aria-expanded", "true");
    list.innerHTML = state.results
      .map(({ item }, i) => renderItemRow(item, i, i === state.selected, false))
      .join("");
    updateActiveDescendant();
  }

  function updateActiveDescendant() {
    const { input, list } = dom;
    const selectedEl = list.querySelector(".is-selected");
    if (selectedEl) {
      input.setAttribute("aria-activedescendant", selectedEl.id);
      // Keep the active row in view
      const offset = selectedEl.offsetTop;
      const top = list.scrollTop;
      const bottom = top + list.clientHeight;
      if (offset < top) list.scrollTop = offset;
      else if (offset + selectedEl.offsetHeight > bottom)
        list.scrollTop = offset + selectedEl.offsetHeight - list.clientHeight;
    } else {
      input.setAttribute("aria-activedescendant", "");
    }
  }

  // ---- Events ----------------------------------------------------------
  function onInput(e) {
    state.query = e.target.value;
    state.selected = 0;
    state.showShortcuts = false;
    render();
  }

  function onInputKey(e) {
    const k = e.key;
    if (k === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (k === "?" && !state.query) {
      e.preventDefault();
      toggleShortcuts();
      return;
    }
    if (state.showShortcuts && k === "Escape") {
      e.preventDefault();
      state.showShortcuts = false;
      render();
      return;
    }
    if (state.showShortcuts) return;
    if (k === "ArrowDown") {
      e.preventDefault();
      if (state.results.length === 0) return;
      state.selected = (state.selected + 1) % state.results.length;
      render();
      return;
    }
    if (k === "ArrowUp") {
      e.preventDefault();
      if (state.results.length === 0) return;
      state.selected =
        (state.selected - 1 + state.results.length) % state.results.length;
      render();
      return;
    }
    if (k === "Home") {
      e.preventDefault();
      state.selected = 0;
      render();
      return;
    }
    if (k === "End") {
      e.preventDefault();
      state.selected = Math.max(0, state.results.length - 1);
      render();
      return;
    }
    if (k === "Enter") {
      e.preventDefault();
      if (state.results.length === 0) return;
      const target = state.results[state.selected];
      if (target) executeItem(target.item, e.metaKey || e.ctrlKey);
    }
  }

  function onListHover(e) {
    const row = e.target.closest("[data-index]");
    if (!row) return;
    const idx = parseInt(row.dataset.index, 10);
    if (Number.isNaN(idx)) return;
    if (idx === state.selected) return;
    state.selected = idx;
    render();
  }

  function onListClick(e) {
    const row = e.target.closest("[data-index]");
    if (!row) return;
    e.preventDefault();
    const idx = parseInt(row.dataset.index, 10);
    if (Number.isNaN(idx)) return;
    const target = state.results[idx];
    if (target) executeItem(target.item, e.metaKey || e.ctrlKey);
  }

  function executeItem(item, newTab) {
    saveRecent(item);
    const url = item.url || "";
    if (!url) {
      close();
      return;
    }
    // External (mailto, calendly, etc.) → open in same tab or new tab
    const external = /^(mailto:|https?:)/.test(url);
    if (newTab) {
      window.open(url, "_blank", "noopener");
    } else if (external) {
      window.location.assign(url);
    } else {
      window.location.assign(url);
    }
    close();
  }

  // ---- Recent searches (localStorage) ----------------------------------
  function loadRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const ids = JSON.parse(raw);
      if (!Array.isArray(ids)) return [];
      const lookup = new Map(state.items.map((i) => [i.id, i]));
      return ids
        .map((id) => lookup.get(id))
        .filter(Boolean)
        .slice(0, MAX_RECENT);
    } catch (_) {
      return [];
    }
  }
  function saveRecent(item) {
    if (!item || !item.id) return;
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      let ids = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(ids)) ids = [];
      ids = [item.id, ...ids.filter((id) => id !== item.id)].slice(
        0,
        MAX_RECENT
      );
      localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
    } catch (_) {
      // localStorage might be unavailable (private mode, quota). Silent.
    }
  }

  // ---- Open / close ----------------------------------------------------
  let lastFocus = null;

  async function open() {
    if (state.open) return;
    buildDOM();
    if (!state.loaded) await loadIndex();
    state.open = true;
    state.showShortcuts = false;
    lastFocus = document.activeElement;
    dom.root.removeAttribute("hidden");
    document.documentElement.classList.add("cg-palette-locked");
    // Focus input on next frame so the open transition can start
    requestAnimationFrame(() => {
      dom.input.value = state.query;
      dom.input.focus();
      dom.input.select();
      render();
    });
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    dom.root.setAttribute("hidden", "");
    document.documentElement.classList.remove("cg-palette-locked");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function toggleShortcuts() {
    if (!dom) return;
    state.showShortcuts = !state.showShortcuts;
    render();
  }

  // ---- Vim-style two-key quick navigation -----------------------------
  //
  // Press `g`, then a second letter, to jump to a section without
  // opening the palette. Mirrors GitHub / Gmail / Linear's pattern.
  // Suppressed when typing in an input/textarea, when the palette is
  // open, or when a modifier key is held (so ⌘+G search-in-page keeps
  // working).
  const QUICK_NAV = {
    h: { url: "/",         label: "Home" },
    p: { url: "/playbook", label: "Playbook" },
    j: { url: "/journal",  label: "Journal" },
    a: { url: "/apply",    label: "Apply" },
    b: { url: "/brands",   label: "Brands" },
    c: { url: "/contact",  label: "Contact" },
    s: { url: "/services", label: "Services" },
    k: { url: "/check",    label: "Fit check" },
    o: { url: "/about",    label: "About" },
    r: { url: "/search",   label: "Search" },
  };

  let quickNavArmed = false;
  let quickNavTimer = null;

  function disarmQuickNav() {
    quickNavArmed = false;
    clearTimeout(quickNavTimer);
    hideHint();
  }

  function showHint(content) {
    let hint = document.querySelector(".cg-palette-hint");
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "cg-palette-hint";
      document.body.appendChild(hint);
    }
    hint.innerHTML = content;
  }
  function hideHint() {
    const hint = document.querySelector(".cg-palette-hint");
    if (hint) hint.remove();
  }

  function isTextField(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // ---- Global shortcut ⌘K / Ctrl K -------------------------------------
  function bindGlobalShortcut() {
    document.addEventListener("keydown", (e) => {
      // ⌘K / Ctrl K toggles
      const isMeta = isMac ? e.metaKey : e.ctrlKey;
      if (isMeta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        disarmQuickNav();
        state.open ? close() : open();
        return;
      }
      if (e.key === "Escape" && state.open) {
        e.preventDefault();
        close();
        return;
      }

      // Vim-style quick-nav: g + <letter>
      if (state.open) return;
      if (isTextField(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!quickNavArmed && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        quickNavArmed = true;
        showHint(
          `<kbd>g</kbd> Go to… <kbd>h</kbd>ome <kbd>p</kbd>laybook <kbd>j</kbd>ournal <kbd>a</kbd>pply <kbd>b</kbd>rands <kbd>c</kbd>ontact <kbd>s</kbd>ervices <kbd>k</kbd>fit-check`
        );
        clearTimeout(quickNavTimer);
        quickNavTimer = setTimeout(disarmQuickNav, 2400);
        return;
      }

      if (quickNavArmed) {
        const key = e.key.toLowerCase();
        if (QUICK_NAV[key]) {
          e.preventDefault();
          disarmQuickNav();
          window.location.assign(QUICK_NAV[key].url);
        } else if (e.key === "Escape") {
          e.preventDefault();
          disarmQuickNav();
        } else {
          disarmQuickNav();
        }
      }
    });
  }

  // ---- Init ------------------------------------------------------------
  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initImpl);
    } else {
      initImpl();
    }
  }
  function initImpl() {
    injectTrigger();
    bindGlobalShortcut();
    // Preload index in the background so first open is instant
    setTimeout(loadIndex, 1200);
  }
  init();
})();
