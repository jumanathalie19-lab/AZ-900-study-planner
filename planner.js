// STUB planner. Same signature and return shape as CONTRACT.md, so app.js can't tell the difference.
// It is deliberately simple. Replace it by pointing app.js at the real ./planner.js.
//
// Returns: array of { date, topicId, isRevision }  (with an optional .warning string on the array)
//          or { error: "message" } for invalid input.

export function generatePlan(examDate, hoursPerDay, domainRatings, topics, today = new Date()) {
  const DAY = 86400000;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = String(examDate).split("-").map(Number);
  const exam = new Date(y, m - 1, d);

  // --- Validation (matches the contract) ---
  if (!(hoursPerDay > 0)) return { error: "Hours per day must be more than 0." };
  if (Number.isNaN(exam.getTime())) return { error: "The exam date isn't valid." };
  const daysAway = Math.round((exam - start) / DAY);
  if (daysAway < 0) return { error: "The exam date is in the past." };
  if (daysAway < 2) return { error: "The exam must be at least 2 days away." };

  const dayAt = (n) => iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + n));

  // Study days run from tomorrow (n = 1) to the day before the exam (n = daysAway - 1).
  const available = daysAway - 1;
  let revisionDays = available < 7 ? 1 : 2;
  if (available - revisionDays < 1) revisionDays = 0; // exam in 2 days: one day only, all study
  const studyDays = available - revisionDays;

  const capacity = hoursPerDay * 60; // minutes per day
  const rating = (t) => domainRatings[t.domain] ?? 3;
  const weight = (r) => (r <= 2 ? 1.5 : r >= 4 ? 0.75 : 1);

  // Weakest domains first.
  const ordered = [...topics].sort((a, b) => rating(a) - rating(b) || a.id - b.id);

  const tasks = [];
  let i = 0;

  // Study days: fill each day up to capacity (a day always gets at least one topic, so the stub can overshoot).
  for (let day = 1; day <= studyDays && i < ordered.length; day++) {
    let used = 0, placed = 0;
    while (i < ordered.length) {
      const cost = Math.round(ordered[i].estimated_minutes * weight(rating(ordered[i])));
      if (placed > 0 && used + cost > capacity) break;
      tasks.push({ date: dayAt(day), topicId: ordered[i].id, isRevision: false });
      used += cost; placed++; i++;
    }
  }

  // Revision days: revisit the weakest topics again.
  let j = 0;
  for (let r = 0; r < revisionDays; r++) {
    let used = 0, placed = 0;
    while (j < ordered.length) {
      const cost = ordered[j].estimated_minutes;
      if (placed > 0 && used + cost > capacity) break;
      tasks.push({ date: dayAt(studyDays + 1 + r), topicId: ordered[j].id, isRevision: true });
      used += cost; placed++; j++;
    }
  }

  if (i < ordered.length) {
    tasks.warning =
      `There isn't enough time to cover every topic at ${hoursPerDay} h/day. ` +
      `We scheduled the weakest areas first and left ${ordered.length - i} topic(s) out.`;
  }
  return tasks;
}
