// AZ-900 Study Planner (Unofficial) – app.js
// One script drives both pages. <body data-page="setup"> or data-page="plan" picks the page.
//
// ============================ SWAP POINT ============================
// While you test the UI these three imports point at the fake-data stubs.
// When the real files arrive, change ONLY these three lines (see the notes in the chat):
//   generatePlan  ->  "./planner.js"
//   db functions  ->  "./db.js"
//   explainTopic  ->  your small client for the Supabase "explain" function
 import { generatePlan } from "./planner.js";
import { savePlan, loadPlan, setTaskDone, loadTopics } from "./db.js";
import { explainTopic } from "./stubs/explain.js";
// =====================================================================

// ---------- Constants (from CONTRACT.md) ----------
const DOMAINS = [
  "Cloud Concepts",
  "Azure Architecture and Services",
  "Azure Management and Governance",
];
const DOMAIN_CLASS = {
  "Cloud Concepts": "dom-cloud",
  "Azure Architecture and Services": "dom-arch",
  "Azure Management and Governance": "dom-mgmt",
};
const PLAN_ID_KEY = "az900_plan_id"; // required by the contract
const LANG_KEY = "az900_lang";       // UI-only: "en" | "sw" (the contract has no language column)
const WARN_KEY = "az900_warning";    // UI-only: planner warning to show once on the plan page
const EXPLAIN_TIMEOUT_MS = 10000;
const MIN_DAYS_AWAY = 2;

const RATING_WORDS = { 1: "Not confident", 2: "A little unsure", 3: "Okay", 4: "Fairly confident", 5: "Very confident" };

// ---------- Tiny helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create an element safely (text goes in as text, never as HTML). */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

// localStorage can throw (private mode, blocked storage), so wrap it.
function getStored(key) { try { return localStorage.getItem(key); } catch { return null; } }
function setStored(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } }
function removeStored(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }

// ---------- Date helpers (ISO "YYYY-MM-DD", always LOCAL time, never UTC) ----------
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseISO(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); }
function startOfToday() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
function formatDate(iso) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" }).format(parseISO(iso));
}

/** The planner may return an array (with an optional .warning), {error}, or {tasks, warning}. Accept all. */
function normalizePlanResult(result) {
  if (Array.isArray(result)) return { tasks: result, warning: result.warning || "" };
  if (result && result.error) return { error: String(result.error) };
  if (result && Array.isArray(result.tasks)) return { tasks: result.tasks, warning: result.warning || "" };
  return { error: "The planner returned something unexpected. Please try again." };
}

// =====================================================================
// PAGE 1: SETUP
// =====================================================================
function initSetup() {
  const form = $("#setup-form");
  const examInput = $("#exam-date");
  const hoursInput = $("#hours");
  const summary = $("#form-errors");
  const submitBtn = $("#submit-btn");
  const fieldErrors = {
    exam: { input: examInput, msg: $("#exam-date-error") },
    hours: { input: hoursInput, msg: $("#hours-error") },
  };

  // Earliest pickable date = today + 2 days (the validation below is the real guard).
  examInput.min = toISO(addDays(startOfToday(), MIN_DAYS_AWAY));

  // Restore the previously chosen language, if any.
  const savedLang = getStored(LANG_KEY);
  if (savedLang === "sw") $("#lang-sw").checked = true;

  // Offer a way back to an existing plan.
  if (getStored(PLAN_ID_KEY)) $("#resume").hidden = false;

  // Live text next to each confidence slider.
  $$(".rating-slider").forEach((slider) => {
    const out = $(`#${slider.id}-out`);
    const update = () => {
      const text = `${slider.value} of 5 – ${RATING_WORDS[slider.value]}`;
      out.textContent = text;
      slider.setAttribute("aria-valuetext", text);
    };
    slider.addEventListener("input", update);
    update();
  });

  // Clear a field's error as soon as the person edits it.
  for (const { input, msg } of Object.values(fieldErrors)) {
    input.addEventListener("input", () => { input.removeAttribute("aria-invalid"); msg.hidden = true; });
  }

  function clearErrors() {
    summary.hidden = true;
    summary.replaceChildren();
    for (const { input, msg } of Object.values(fieldErrors)) {
      input.removeAttribute("aria-invalid");
      msg.hidden = true;
      msg.textContent = "";
    }
  }

  function showSummary(messages) {
    summary.replaceChildren(
      el("p", {}, "Let's fix a couple of things:"),
      el("ul", {}, messages.map((m) => el("li", {}, m)))
    );
    summary.hidden = false;
  }

  function setFieldError(key, message, problems) {
    const { input, msg } = fieldErrors[key];
    input.setAttribute("aria-invalid", "true");
    msg.textContent = message;
    msg.hidden = false;
    problems.push({ input, message });
  }

  /** Validate the form. Returns { ok, values } or { ok:false } after showing friendly errors. */
  function validate() {
    clearErrors();
    const problems = [];

    // Exam date: required, in the future, at least 2 days away.
    let examDate = examInput.value;
    if (!examDate) {
      setFieldError("exam", "Please pick your exam date.", problems);
    } else {
      const away = daysBetween(startOfToday(), parseISO(examDate));
      if (Number.isNaN(away)) setFieldError("exam", "That date doesn't look right. Please pick it again.", problems);
      else if (away < 0) setFieldError("exam", "That date has already passed. Please pick a date in the future.", problems);
      else if (away < MIN_DAYS_AWAY) setFieldError("exam", "Your exam needs to be at least 2 days away so we can build a useful plan.", problems);
    }

    // Hours: 0.5 to 8 in steps of 0.5.
    const hours = parseFloat(hoursInput.value);
    if (Number.isNaN(hours)) setFieldError("hours", "Please enter how many hours you can study each day.", problems);
    else if (hours < 0.5 || hours > 8) setFieldError("hours", "Please choose between 0.5 and 8 hours per day.", problems);
    else if (Math.round(hours * 2) !== hours * 2) setFieldError("hours", "Please use steps of half an hour, for example 1 or 1.5.", problems);

    if (problems.length) {
      showSummary(problems.map((p) => p.message));
      problems[0].input.focus();
      return { ok: false };
    }

    const ratings = {};
    $$(".rating-slider").forEach((s) => { ratings[s.dataset.domain] = Number(s.value); });
    const language = $('input[name="language"]:checked').value;
    return { ok: true, values: { examDate, hours, ratings, language } };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const check = validate();
    if (!check.ok) return;
    const { examDate, hours, ratings, language } = check.values;

    submitBtn.disabled = true;
    submitBtn.textContent = "Building your plan…";
    try {
      const topics = await loadTopics();
      const { tasks, warning, error } = normalizePlanResult(generatePlan(examDate, hours, ratings, topics));

      if (error) { showSummary([error]); summary.focus(); return; }
      if (!tasks.length) {
        showSummary(["We couldn't fit any topics into that time. Try more hours per day or a later exam date."]);
        summary.focus();
        return;
      }

      // Column-shaped objects, so db.js can insert them as they are.
      const planId = await savePlan(
        { exam_date: examDate, hours_per_day: hours, ratings },
        tasks.map((t) => ({ topic_id: t.topicId, scheduled_date: t.date, is_revision: Boolean(t.isRevision) }))
      );

      setStored(PLAN_ID_KEY, planId);
      setStored(LANG_KEY, language);
      if (warning) setStored(WARN_KEY, warning); else removeStored(WARN_KEY);
      window.location.href = "plan.html";
    } catch (err) {
      console.warn("Could not create the plan:", err);
      showSummary(["Something went wrong while creating your plan. Please check your connection and try again."]);
      summary.focus();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create my study plan";
    }
  });
}

// =====================================================================
// PAGE 2: PLAN
// =====================================================================
function initPlan() {
  // ---- State ----
  const S = {
    plan: null,
    tasks: [],               // [{ id, topic_id, scheduled_date, done, is_revision }]
    topics: new Map(),       // topic id -> topic
    cards: new Map(),        // task -> its <li>
  };

  const ui = {
    state: $("#state"),
    view: $("#plan-view"),
    countdown: $("#countdown"),
    ring: $("#ring"),
    ringFill: $("#ring-fill"),
    ringLabel: $("#ring-label"),
    progressText: $("#progress-text"),
    status: $("#status"),
    bars: $("#domain-bars"),
    days: $("#days"),
    warning: $("#warning"),
    warningText: $("#warning-text"),
    toast: $("#toast"),
  };

  const RING_C = 2 * Math.PI * 42; // circumference for r = 42
  ui.ringFill.style.strokeDasharray = String(RING_C);

  const topicOf = (task) =>
    S.topics.get(task.topic_id) ||
    { id: task.topic_id, title: `Topic ${task.topic_id}`, domain: "", estimated_minutes: 0, learn_url: "https://learn.microsoft.com/training/", fallback_explanation: "" };

  // ---- Page states ----
  function showState(kind) {
    ui.view.hidden = kind !== "ready";
    if (kind === "ready") { ui.state.replaceChildren(); return; }

    if (kind === "loading") {
      ui.state.replaceChildren(el("div", { class: "spinner", "aria-hidden": "true" }), el("p", {}, "Loading your plan…"));
    } else if (kind === "empty") {
      ui.state.replaceChildren(
        el("h2", {}, "No plan yet"),
        el("p", { class: "muted" }, "Let's build one together. It only takes a minute."),
        el("a", { class: "btn primary", href: "index.html" }, "Create my plan")
      );
    } else if (kind === "error") {
      ui.state.replaceChildren(
        el("h2", {}, "We couldn't load your plan"),
        el("p", { class: "muted" }, "This is usually a connection hiccup. Your progress is safe."),
        el("button", { type: "button", class: "btn primary", onclick: load }, "Try again")
      );
    }
  }

  function toast(message) {
    ui.toast.textContent = message;
    ui.toast.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { ui.toast.hidden = true; }, 4000);
  }

  // ---- Load ----
  async function load() {
    const planId = getStored(PLAN_ID_KEY);
    if (!planId) { showState("empty"); return; }

    showState("loading");
    try {
      const [data, topics] = await Promise.all([loadPlan(planId), loadTopics()]);
      if (!data || !data.plan) { showState("empty"); return; }

      S.plan = data.plan;
      S.tasks = [...(data.tasks || [])].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
      S.topics = new Map(topics.map((t) => [t.id, t]));

      showState("ready");
      renderWarning();
      renderDays();
      renderSummary();
    } catch (err) {
      console.warn("Could not load the plan:", err);
      showState("error");
    }
  }

  // ---- Summary: countdown, ring, status, per-domain bars ----
  function renderSummary() {
    const today = startOfToday();
    const todayISO = toISO(today);
    const total = S.tasks.length;
    const done = S.tasks.filter((t) => t.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    // Countdown
    const away = daysBetween(today, parseISO(S.plan.exam_date));
    ui.countdown.textContent =
      away > 1 ? `${away} days to your exam` :
      away === 1 ? "1 day to your exam" :
      away === 0 ? "Your exam is today. You've got this!" :
      "Your exam date has passed";

    // Overall ring
    ui.ringFill.style.strokeDashoffset = String(RING_C * (1 - pct / 100));
    ui.ringLabel.textContent = `${pct}%`;
    ui.ring.setAttribute("aria-valuenow", String(pct));
    ui.progressText.textContent = `${done} of ${total} tasks done`;

    // Status: compare tasks done with tasks scheduled BEFORE today.
    // (Counting today's tasks would make everyone "behind" every morning.)
    const dueBeforeToday = S.tasks.filter((t) => t.scheduled_date < todayISO).length;
    const behindBy = dueBeforeToday - done;
    let text, cls;
    if (total && done === total) { text = "All done. Brilliant work!"; cls = "ok"; }
    else if (behindBy > 0) { text = `Behind by ${behindBy} ${behindBy === 1 ? "task" : "tasks"}. Try a catch-up session`; cls = "behind"; }
    else { text = "On track"; cls = "ok"; }
    ui.status.textContent = text;
    ui.status.className = `status ${cls}`;

    // Per-domain bars
    ui.bars.replaceChildren(
      ...DOMAINS.map((domain) => {
        const inDomain = S.tasks.filter((t) => topicOf(t).domain === domain);
        const doneIn = inDomain.filter((t) => t.done).length;
        const p = inDomain.length ? Math.round((doneIn / inDomain.length) * 100) : 0;
        return el("li", { class: DOMAIN_CLASS[domain] },
          el("div", { class: "bar-label" }, el("span", {}, domain), el("span", {}, `${p}%`)),
          el("div", {
            class: "bar", role: "progressbar", "aria-label": `${domain} progress`,
            "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(p),
          }, el("span", { class: "bar-fill", style: `width:${p}%` })),
          el("p", { class: "bar-sub" }, inDomain.length ? `${doneIn} of ${inDomain.length} tasks` : "No tasks in this area")
        );
      })
    );
  }

  function renderWarning() {
    const warning = getStored(WARN_KEY);
    ui.warning.hidden = !warning;
    ui.warningText.textContent = warning || "";
  }
  $("#warning-dismiss").addEventListener("click", () => { removeStored(WARN_KEY); ui.warning.hidden = true; });

  // ---- Tasks grouped by date ----
  function renderDays() {
    const todayISO = toISO(startOfToday());
    S.cards.clear();

    const groups = new Map();
    for (const task of S.tasks) {
      if (!groups.has(task.scheduled_date)) groups.set(task.scheduled_date, []);
      groups.get(task.scheduled_date).push(task);
    }

    const sections = [...groups.entries()].map(([date, tasks]) => {
      const isToday = date === todayISO;
      const allRevision = tasks.every((t) => t.is_revision);
      const list = el("ul", { class: "task-list" }, tasks.map(buildTaskCard));

      return el("section", { class: `day${isToday ? " today" : ""}`, "data-date": date, "aria-label": formatDate(date) },
        el("div", { class: "day-head" },
          el("h3", {}, formatDate(date)),
          isToday && el("span", { class: "tag today" }, "Today"),
          allRevision && el("span", { class: "tag revision" }, "Revision day"),
          el("span", { class: "day-count", "data-count-for": date }, dayCountText(tasks))
        ),
        list
      );
    });

    ui.days.replaceChildren(...sections);
  }

  const dayCountText = (tasks) => `${tasks.filter((t) => t.done).length} of ${tasks.length} done`;

  function buildTaskCard(task) {
    const topic = topicOf(task);
    const checkId = `task-${task.id}`;

    const checkbox = el("input", { type: "checkbox", class: "task-check", id: checkId, checked: Boolean(task.done) });
    checkbox.addEventListener("change", () => onToggle(task, checkbox));

    const card = el("li", { class: `task${task.done ? " is-done" : ""}` },
      el("div", { class: "task-main" },
        checkbox,
        el("label", { class: "task-title", for: checkId }, topic.title)
      ),
      el("div", { class: "task-meta" },
        topic.domain && el("span", { class: `badge ${DOMAIN_CLASS[topic.domain] || ""}` }, topic.domain),
        topic.estimated_minutes ? el("span", {}, `${topic.estimated_minutes} min`) : null,
        task.is_revision && el("span", { class: "tag revision" }, "Revision")
      ),
      el("div", { class: "task-actions" },
        el("a", { class: "btn small secondary", href: topic.learn_url || "https://learn.microsoft.com/training/", target: "_blank", rel: "noopener noreferrer" },
          "Study on Microsoft Learn", el("span", { class: "sr-only" }, " (opens in a new tab)")),
        el("button", { type: "button", class: "btn small ghost", onclick: () => openExplain(topic) }, "Explain this simply")
      )
    );

    S.cards.set(task, card);
    return card;
  }

  /** Optimistic update: tick immediately, save in the background, undo if saving fails. */
  async function onToggle(task, checkbox) {
    const wanted = checkbox.checked;
    const previous = task.done;
    apply(task, wanted);
    try {
      await setTaskDone(task.id, wanted);
    } catch (err) {
      console.warn("Could not save task:", err);
      checkbox.checked = previous;
      apply(task, previous);
      toast("We couldn't save that tick. Please try again.");
    }
  }

  function apply(task, done) {
    task.done = done;
    S.cards.get(task)?.classList.toggle("is-done", done);
    const count = $(`[data-count-for="${task.scheduled_date}"]`);
    if (count) count.textContent = dayCountText(S.tasks.filter((t) => t.scheduled_date === task.scheduled_date));
    renderSummary();
  }

  // ---- Start a new plan ----
  $("#new-plan-btn").addEventListener("click", () => {
    if (window.confirm("Start a new plan? This plan will no longer be shown on this device.")) {
      removeStored(PLAN_ID_KEY);
      removeStored(WARN_KEY);
      window.location.href = "index.html";
    }
  });

  // ---- "Explain this simply" modal ----
  const dlg = $("#explain-dialog");
  const body = $("#explain-body");
  const note = $("#explain-note");
  const copyBtn = $("#explain-copy");
  let explainToken = 0;   // lets us ignore answers that arrive after the modal was closed or reopened
  let explainText = "";

  async function openExplain(topic) {
    const token = ++explainToken;
    const language = getStored(LANG_KEY) === "sw" ? "sw" : "en";

    $("#explain-title").textContent = topic.title;
    $("#explain-sub").textContent = `${topic.domain || "AZ-900"} · ${language === "sw" ? "Kiswahili" : "English"}`;
    explainText = "";
    note.hidden = true;
    copyBtn.disabled = true;
    copyBtn.textContent = "Copy";
    body.className = "explain-text is-loading";
    body.replaceChildren(el("div", {}, el("div", { class: "spinner", "aria-hidden": "true" }), el("p", {}, "Asking your friendly tutor…")));
    if (!dlg.open) dlg.showModal();

    const result = await fetchExplanation(topic, language);
    if (token !== explainToken) return; // closed or replaced while we waited

    body.className = "explain-text";
    if (result.kind === "unavailable") {
      body.textContent = "Explanation unavailable right now. Use the Microsoft Learn link.";
      return;
    }
    explainText = result.text;
    body.textContent = result.text;
    copyBtn.disabled = false;
    if (result.kind === "offline") { note.textContent = "Showing offline explanation"; note.hidden = false; }
  }

  /** Ask the explain function; after 10 seconds (or any error) fall back to the topic's offline text. */
  async function fetchExplanation(topic, language) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("timed out after 10 seconds")); }, EXPLAIN_TIMEOUT_MS);
    });
    try {
      const res = await Promise.race([
        explainTopic({ topic: topic.title, domain: topic.domain, language }, controller.signal),
        timeout,
      ]);
      if (!res || typeof res.text !== "string" || !res.text.trim()) throw new Error("empty response");
      return { kind: "ai", text: res.text.trim() };
    } catch (err) {
      console.warn("Explain failed, using offline text:", err.message);
      const fallback = (topic.fallback_explanation || "").trim();
      return fallback ? { kind: "offline", text: fallback } : { kind: "unavailable", text: "" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function copyExplanation() {
    if (!explainText) return;
    let ok = false;
    try { await navigator.clipboard.writeText(explainText); ok = true; }
    catch {
      // Fallback for browsers that block the async clipboard API.
      const ta = el("textarea", { "aria-hidden": "true", style: "position:fixed;opacity:0" });
      ta.value = explainText;
      document.body.append(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
    }
    copyBtn.textContent = ok ? "Copied!" : "Couldn't copy";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
  }

  copyBtn.addEventListener("click", copyExplanation);
  $("#explain-close").addEventListener("click", () => dlg.close());
  $("#explain-done").addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", () => { explainToken++; });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // click on the backdrop

  load();
}

// ---------- Boot ----------
const page = document.body.dataset.page;
if (page === "setup") initSetup();
else if (page === "plan") initPlan();
