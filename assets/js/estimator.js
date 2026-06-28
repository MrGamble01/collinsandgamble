/*
 * Collins & Gamble — Earnings Estimator (/math)
 *
 * Live two-way binding between the form on the left and the result panel
 * on the right. The model is intentionally explicit, conservative, and
 * range-based so users can see the math and argue with the floors/ceilings
 * instead of trusting a single fake-precise number.
 *
 * Model
 * -----
 *   monthly_low  = clicks × conv_lo × session_lo × commission_lo
 *   monthly_high = clicks × conv_hi × session_hi × commission_hi
 *   monthly_likely = geometric mean of low and high (less skewed than
 *                    the arithmetic mean when ranges span an order of
 *                    magnitude)
 *
 * Multipliers
 * -----------
 *   A. Clicks/month — uploads/week × 4.3 × audience-click multiplier
 *      Audience-click multiplier scales sub-linearly with audience size:
 *      not a 10× increase from 10k to 100k creators, ~4× in practice.
 *
 *   B. Conversion — 3% (browse) to 8% (intent-heavy review traffic).
 *
 *   C. Session value — AOV × 1.4 (low) to 2.0 (high), since storefront
 *      sessions tend to include products beyond the clicked item.
 *
 *   D. Commission — Amazon Associates rate by category. Beauty and
 *      luxury are the outliers; most categories sit between 1–4%.
 *
 * Disclaimer
 * ----------
 * This is a model, not a guarantee. Amazon publishes rates but not
 * personal performance. The output is a planning aid for creators
 * deciding whether to invest the cadence to get there, not a financial
 * projection in any formal sense.
 */
(() => {
  const root = document.querySelector("[data-math]");
  if (!root) return;

  const STORAGE_KEY = "cg:math:draft:v1";

  const form = root.querySelector("[data-math-form]");
  const result = root.querySelector("[data-math-result]");
  const savedFlag = root.querySelector("[data-math-saved]");
  const resetBtn = root.querySelector("[data-math-reset]");

  const inputs = Array.from(form.querySelectorAll("[data-key]"));

  // ---- Defaults --------------------------------------------------------
  const DEFAULTS = {
    cadence: "3",
    audience: "small",
    category: "fashion",
    aov: "mid",
  };

  // ---- Model parameters ------------------------------------------------

  // Audience bucket → click multiplier per upload (low, high).
  // Models how many storefront clicks an upload draws on average.
  // Sub-linear with audience size — the realistic curve.
  const AUDIENCE = {
    micro: { label: "Under 5,000", clickMul: [3, 9] },
    small: { label: "5k – 25k", clickMul: [10, 26] },
    mid:   { label: "25k – 100k", clickMul: [22, 58] },
    large: { label: "100k – 500k", clickMul: [42, 110] },
    mega:  { label: "500k+", clickMul: [80, 200] },
  };

  // Conversion rate range (click → purchased session within 24h).
  // The same for every input — Amazon's session attribution doesn't
  // change with category, only the rate downstream does.
  const CONV = [0.03, 0.08];

  // Session value multiplier: shoppers buy more than just the clicked item.
  const SESSION_MULT = [1.4, 2.0];

  // AOV bucket → midpoint price ($), used as the per-session base.
  const AOV = {
    cheap:   { label: "Under $25", base: 18 },
    mid:     { label: "$25 – $75", base: 50 },
    premium: { label: "$75 – $200", base: 130 },
    luxury:  { label: "$200+", base: 280 },
  };

  // Commission rates by category (low, high), as decimals.
  // Tracks the Amazon Associates fee schedule for the relevant category.
  const COMMISSION = {
    luxury:      { label: "Luxury beauty", rate: [0.08, 0.10] },
    beauty:      { label: "Beauty", rate: [0.03, 0.10] },
    furniture:   { label: "Furniture / kitchen", rate: [0.03, 0.045] },
    fashion:     { label: "Fashion", rate: [0.04, 0.04] },
    outdoors:    { label: "Outdoors / sports", rate: [0.025, 0.03] },
    grocery:     { label: "Grocery / pets / baby", rate: [0.01, 0.03] },
    electronics: { label: "Electronics", rate: [0.015, 0.025] },
    mixed:       { label: "Mixed", rate: [0.025, 0.035] },
  };

  // ---- Persist ---------------------------------------------------------
  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch (_) { return {}; }
  }
  function saveDraft(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      flashSaved();
    } catch (_) {}
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

  // ---- Read form -------------------------------------------------------
  function readForm() {
    const data = {};
    for (const el of inputs) {
      const key = el.dataset.key;
      if (!key) continue;
      data[key] = el.value;
    }
    return data;
  }

  // ---- Compute ---------------------------------------------------------
  function compute(data) {
    const cadence = Math.max(0, parseFloat(data.cadence) || 0);
    const aud = AUDIENCE[data.audience] || AUDIENCE.small;
    const aov = AOV[data.aov] || AOV.mid;
    const comm = COMMISSION[data.category] || COMMISSION.mixed;

    // A. Clicks per month
    const weeks = 4.3;
    const clicksLow = cadence * weeks * aud.clickMul[0];
    const clicksHigh = cadence * weeks * aud.clickMul[1];

    // B. Conversion
    const convLow = CONV[0];
    const convHigh = CONV[1];

    // C. Session value
    const sessLow = aov.base * SESSION_MULT[0];
    const sessHigh = aov.base * SESSION_MULT[1];

    // D. Commission
    const commLow = comm.rate[0];
    const commHigh = comm.rate[1];

    const monthlyLow = clicksLow * convLow * sessLow * commLow;
    const monthlyHigh = clicksHigh * convHigh * sessHigh * commHigh;
    const monthlyLikely =
      monthlyLow > 0 && monthlyHigh > 0
        ? Math.sqrt(monthlyLow * monthlyHigh)
        : (monthlyLow + monthlyHigh) / 2;

    return {
      monthly: { low: monthlyLow, likely: monthlyLikely, high: monthlyHigh },
      annual: { low: monthlyLow * 12, high: monthlyHigh * 12 },
      // For the explainer panel
      clicks: { low: clicksLow, high: clicksHigh },
      conv: { low: convLow, high: convHigh },
      session: { low: sessLow, high: sessHigh },
      commission: { low: commLow, high: commHigh },
    };
  }

  // ---- Formatting ------------------------------------------------------
  function money(n) {
    if (!isFinite(n) || n < 0) n = 0;
    if (n < 100) return Math.round(n).toString();
    if (n < 10000) return Math.round(n).toLocaleString("en-US");
    if (n < 1000000) return Math.round(n).toLocaleString("en-US");
    return Math.round(n).toLocaleString("en-US");
  }
  function moneyShort(n) {
    if (!isFinite(n) || n < 0) n = 0;
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
    return Math.round(n).toString();
  }
  function pct(n) {
    return (n * 100).toFixed(1).replace(/\.0$/, "") + "%";
  }
  function rangeMoney(lo, hi) {
    if (Math.round(lo) === Math.round(hi)) return "$" + money(lo);
    return "$" + money(lo) + " – $" + money(hi);
  }
  function rangePct(lo, hi) {
    if (lo === hi) return pct(lo);
    return pct(lo) + " – " + pct(hi);
  }

  // ---- Render ----------------------------------------------------------
  function set(key, value) {
    const els = root.querySelectorAll('[data-out="' + key + '"]');
    els.forEach((el) => { el.textContent = value; });
  }

  // Meter fills 0 → 100% for $0 → $10k+. Log-ish scale via piecewise.
  function meterPct(amount) {
    if (amount <= 0) return 0;
    if (amount <= 2000) return (amount / 2000) * 33;
    if (amount <= 5000) return 33 + ((amount - 2000) / 3000) * 33;
    if (amount <= 10000) return 66 + ((amount - 5000) / 5000) * 30;
    return Math.min(100, 96 + (amount - 10000) / 5000);
  }

  function render() {
    const data = readForm();
    saveDraft(data);

    // Update the cadence number output (range slider)
    const cadenceEl = root.querySelector("#m-cadence");
    if (cadenceEl) set("cadence", cadenceEl.value);

    const r = compute(data);

    set("low", money(r.monthly.low));
    set("high", money(r.monthly.high));
    set("likely", money(r.monthly.likely));
    set("annual-low", money(r.annual.low));
    set("annual-high", money(r.annual.high));

    // Meter
    const fillPct = meterPct(r.monthly.high);
    const markerPct = meterPct(r.monthly.likely);
    const fillEl = root.querySelector('[data-out="meter-fill"]');
    const markerEl = root.querySelector('[data-out="meter-marker"]');
    if (fillEl) fillEl.style.width = fillPct + "%";
    if (markerEl) markerEl.style.left = markerPct + "%";

    // Explainer values
    set(
      "A",
      "~" + moneyShort(r.clicks.low).replace("k", "k") +
        " – " + moneyShort(r.clicks.high) + " clicks"
    );
    set("B", rangePct(r.conv.low, r.conv.high));
    set("C", "$" + money(r.session.low) + " – $" + money(r.session.high) + " / session");
    set("D", rangePct(r.commission.low, r.commission.high));
  }

  // ---- Reset -----------------------------------------------------------
  function reset() {
    for (const el of inputs) {
      const key = el.dataset.key;
      if (DEFAULTS[key] !== undefined) el.value = DEFAULTS[key];
    }
    clearDraft();
    render();
  }

  // ---- Init ------------------------------------------------------------
  function init() {
    const saved = loadDraft();
    for (const el of inputs) {
      const key = el.dataset.key;
      if (key && saved[key] !== undefined && saved[key] !== "") {
        el.value = saved[key];
      }
    }

    let renderTimer = null;
    const schedule = () => {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(render, 40);
    };
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    if (resetBtn) resetBtn.addEventListener("click", reset);

    render();
  }

  init();
})();
