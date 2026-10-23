// planner.js: rule-based study planner (no AI, so dates are always correct)
// Owner: Person 2. See CONTRACT.md.
//
// generatePlan(examDate, hoursPerDay, domainRatings, topics, today = new Date())
//   -> array of { date, topicId, isRevision, minutes }
//      The array also has two extra properties:
//        plan.warning     string ("" when everything fits)
//        plan.unscheduled array of topic ids that did not fit
//   -> or { error: "message" } for invalid input

const DAY_MS = 86400000;
const DEFAULT_RATING = 3;

const pad = (n) => String(n).padStart(2, "0");

// Local calendar date of a JS Date as "YYYY-MM-DD" (uses the learner's own time zone)
function localISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "YYYY-MM-DD" -> UTC midnight timestamp (NaN if invalid). Working in UTC avoids daylight-saving bugs.
function isoToUTC(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return NaN;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return new Date(t).getUTCMonth() === +m[2] - 1 ? t : NaN; // rejects e.g. 2026-02-31
}

function utcToISO(t) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Low confidence -> more time, high confidence -> less time
function multiplier(rating) {
  if (rating <= 2) return 1.5;
  if (rating <= 3) return 1;
  return 0.75;
}

// Place topics into `days` day-slots without exceeding `budget` minutes per day.
// spread=true spaces topics out across the days instead of front-loading them.
function pack(list, days, budget, spread) {
  const total = list.reduce((s, it) => s + it.weighted, 0);
  const loads = new Array(days).fill(0);
  const placed = [];
  const leftover = [];
  let d = 0;
  let cum = 0;
  for (const it of list) {
    if (spread) {
      const target = Math.min(days - 1, Math.floor((cum / total) * days));
      if (d < target) d = target;
    }
    while (d < days && loads[d] > 0 && loads[d] + it.weighted > budget) d++;
    if (d >= days) {
      leftover.push(it);
    } else {
      loads[d] += it.weighted;
      placed.push({ dayIndex: d, item: it });
    }
    cum += it.weighted;
  }
  return { placed, leftover };
}

export function generatePlan(examDate, hoursPerDay, domainRatings, topics, today = new Date()) {
  // ---- 1. Validate input ----
  const examT = isoToUTC(examDate);
  if (Number.isNaN(examT)) return { error: "Please enter a valid exam date." };

  const todayT = isoToUTC(localISO(today));
  const daysUntil = Math.round((examT - todayT) / DAY_MS);
  if (daysUntil < 0) return { error: "Your exam date is in the past." };
  if (daysUntil < 2) return { error: "Your exam must be at least 2 days away to build a plan." };

  const hours = Number(hoursPerDay);
  if (!(hours > 0)) return { error: "Study hours per day must be greater than 0." };
  if (!Array.isArray(topics) || topics.length === 0) return { error: "No topics available to plan." };

  const capacity = Math.max(1, Math.round(hours * 60)); // minutes available per day

  // ---- 2. Prepare topics: weight by confidence, weakest domain first ----
  const rating = (domain) => {
    const r = Number(domainRatings && domainRatings[domain]);
    return Number.isFinite(r) ? Math.min(5, Math.max(1, r)) : DEFAULT_RATING;
  };

  let anyCapped = false;
  const items = topics
    .map((t) => {
      const raw = Number(t.estimated_minutes) || 45;
      const r = rating(t.domain);
      const wanted = Math.max(1, Math.round(raw * multiplier(r)));
      if (wanted > capacity) anyCapped = true; // topic longer than one day's time
      return { id: Number(t.id), domain: t.domain, rating: r, raw, weighted: Math.min(capacity, wanted) };
    })
    .sort((a, b) => a.rating - b.rating || String(a.domain).localeCompare(String(b.domain)) || a.id - b.id);

  // ---- 3. Split the calendar: study days, then 1-2 revision days at the end ----
  const usableDays = daysUntil - 1; // tomorrow .. day before the exam
  const revisionDays = usableDays >= 7 ? 2 : usableDays >= 2 ? 1 : 0;
  const studyDays = usableDays - revisionDays;

  // ---- 4. Schedule study topics (try an even spread first, then pack tighter) ----
  const total = items.reduce((s, it) => s + it.weighted, 0);
  let budget = Math.min(capacity, Math.ceil(total / studyDays));
  let res = pack(items, studyDays, budget, true);
  while (res.leftover.length && budget < capacity) {
    budget = Math.min(capacity, Math.ceil(budget * 1.15) + 1);
    res = pack(items, studyDays, budget, true);
  }
  if (res.leftover.length) res = pack(items, studyDays, capacity, false);

  const plan = res.placed.map(({ dayIndex, item }) => ({
    date: utcToISO(todayT + (dayIndex + 1) * DAY_MS),
    topicId: item.id,
    isRevision: false,
    minutes: item.weighted,
  }));

  // ---- 5. Revision days: weakest domains first, only topics already studied ----
  if (revisionDays > 0 && res.placed.length > 0) {
    const revItems = res.placed.map((p) => ({ ...p.item, weighted: Math.min(capacity, p.item.raw) }));
    const rev = pack(revItems, revisionDays, capacity, false);
    for (const { dayIndex, item } of rev.placed) {
      plan.push({
        date: utcToISO(todayT + (studyDays + 1 + dayIndex) * DAY_MS),
        topicId: item.id,
        isRevision: true,
        minutes: item.weighted,
      });
    }
  }

  plan.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ---- 6. Warnings ----
  const warnings = [];
  if (res.leftover.length) {
    warnings.push(
      `Not enough time for all topics: ${res.leftover.length} topic(s) could not be scheduled. ` +
        `Your weakest domains were prioritised. Try more hours per day or a later exam date.`
    );
  }
  if (anyCapped) {
    warnings.push("Some topics need more than one day's study time, so they take a whole day.");
  }
  plan.warning = warnings.join(" ");
  plan.unscheduled = res.leftover.map((it) => it.id);
  return plan;
}
