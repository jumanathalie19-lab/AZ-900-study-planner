// Run with:  node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePlan } from "./planner.js";

const D1 = "Cloud Concepts";
const D2 = "Azure Architecture and Services";
const D3 = "Azure Management and Governance";

const topics = [];
let nextId = 1;
for (const [domain, n] of [[D1, 6], [D2, 8], [D3, 6]]) {
  for (let i = 0; i < n; i++) {
    topics.push({ id: nextId, domain, title: `Topic ${nextId}`, estimated_minutes: 45 });
    nextId++;
  }
}

const TODAY = new Date(2026, 9, 23, 12, 0, 0); // 23 Oct 2026, local time
const pad = (n) => String(n).padStart(2, "0");
function inDays(n) {
  const d = new Date(2026, 9, 23 + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const ratings = (a, b, c) => ({ [D1]: a, [D2]: b, [D3]: c });
function dayTotals(plan) {
  const t = {};
  for (const p of plan) t[p.date] = (t[p.date] || 0) + p.minutes;
  return t;
}
const maxDay = (plan) => Math.max(...Object.values(dayTotals(plan)));
const sum = (plan) => plan.reduce((s, p) => s + p.minutes, 0);

test("exam in the past -> error", () => {
  assert.ok(generatePlan(inDays(-3), 2, ratings(3, 3, 3), topics, TODAY).error);
});
test("exam today or tomorrow (under 2 days) -> error", () => {
  assert.ok(generatePlan(inDays(0), 2, ratings(3, 3, 3), topics, TODAY).error);
  assert.ok(generatePlan(inDays(1), 2, ratings(3, 3, 3), topics, TODAY).error);
});
test("invalid date or hours -> error", () => {
  assert.ok(generatePlan("not-a-date", 2, ratings(3, 3, 3), topics, TODAY).error);
  assert.ok(generatePlan("2026-02-31", 2, ratings(3, 3, 3), topics, TODAY).error);
  assert.ok(generatePlan(inDays(30), 0, ratings(3, 3, 3), topics, TODAY).error);
  assert.ok(generatePlan(inDays(30), -1, ratings(3, 3, 3), topics, TODAY).error);
});
test("exam in 2 days -> one study day, no revision day", () => {
  const plan = generatePlan(inDays(2), 3, ratings(3, 3, 3), topics, TODAY);
  assert.ok(!plan.error);
  assert.ok(plan.every((p) => p.date === inDays(1) && !p.isRevision));
  assert.ok(maxDay(plan) <= 180);
});
test("exam in 3 days -> revision day, warning, never over the daily limit", () => {
  const plan = generatePlan(inDays(3), 2, ratings(3, 3, 3), topics, TODAY);
  assert.ok(!plan.error);
  assert.ok(plan.some((p) => p.isRevision));
  assert.ok(plan.warning.length > 0);
  assert.ok(plan.unscheduled.length > 0);
  assert.ok(maxDay(plan) <= 120);
  assert.ok(plan.every((p) => p.date >= inDays(1) && p.date <= inDays(2)));
});
test("exam in 60 days -> everything scheduled once, 2 revision days at the end", () => {
  const plan = generatePlan(inDays(60), 2, ratings(3, 3, 3), topics, TODAY);
  assert.ok(!plan.error);
  assert.equal(plan.warning, "");
  const study = plan.filter((p) => !p.isRevision);
  assert.equal(new Set(study.map((p) => p.topicId)).size, topics.length);
  assert.equal(study.length, topics.length);
  assert.ok(plan.some((p) => p.isRevision && p.date === inDays(59)));
  assert.ok(plan.every((p) => p.date >= inDays(1) && p.date <= inDays(59)));
  assert.ok(maxDay(plan) <= 120);
});
test("0.5 hours per day -> no day over 30 minutes, warns about long topics", () => {
  const plan = generatePlan(inDays(60), 0.5, ratings(3, 3, 3), topics, TODAY);
  assert.ok(!plan.error);
  assert.ok(maxDay(plan) <= 30);
  assert.ok(plan.warning.length > 0);
});
test("all domains rated 5 vs all rated 1 -> different amounts of study time", () => {
  const easy = generatePlan(inDays(60), 3, ratings(5, 5, 5), topics, TODAY);
  const hard = generatePlan(inDays(60), 3, ratings(1, 1, 1), topics, TODAY);
  assert.ok(!easy.error && !hard.error);
  assert.ok(sum(hard) > sum(easy));
});
test("weakest domain is scheduled first", () => {
  const plan = generatePlan(inDays(30), 2, ratings(1, 5, 5), topics, TODAY);
  const first = topics.find((t) => t.id === plan[0].topicId);
  assert.equal(first.domain, D1);
});
test("CSV-style string values still work", () => {
  const csvTopics = topics.map((t) => ({ ...t, id: String(t.id), estimated_minutes: String(t.estimated_minutes) }));
  const plan = generatePlan(inDays(30), "2", ratings(3, 3, 3), csvTopics, TODAY);
  assert.ok(!plan.error);
  assert.ok(plan.length > 0);
});
