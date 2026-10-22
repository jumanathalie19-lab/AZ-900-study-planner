# CONTRACT: AZ-900 Study Planner (UNOFFICIAL)

Rules for everyone:
- One owner per file. Never edit another person's file; ask them.
- Unofficial study tool. Not affiliated with or endorsed by Microsoft. No Microsoft logos. All content is original.
- Dates are ISO strings "YYYY-MM-DD". Domains are exactly these three strings:
  "Cloud Concepts" | "Azure Architecture and Services" | "Azure Management and Governance"
- Never put API keys in the repo or the browser.

## Topic shape (data/topics.csv, header row required)
id,domain,title,estimated_minutes,learn_url,fallback_explanation
(id is a number 1..N, estimated_minutes 30 to 60, fallback_explanation 60-100 words, original, with one African-life analogy)

## Planner (planner.js, ES module)
export function generatePlan(examDate, hoursPerDay, domainRatings, topics, today = new Date())
- domainRatings: { "Cloud Concepts": 1-5, "Azure Architecture and Services": 1-5, "Azure Management and Governance": 1-5 }
- topics: array of the topic shape above
- returns: array of { date, topicId, isRevision }
- returns { error: "message" } for invalid input (exam in the past, fewer than 2 days away, hoursPerDay <= 0)
Rules: study days run from tomorrow to the day before the exam; reserve the last 1-2 days for revision of the weakest domains; lower ratings get more time; never exceed hoursPerDay in a day; if time is short, prioritise the weakest domains and also return a "warning" string.

## Database (db.js + schema.sql, Supabase)
Tables: topics, plans(id uuid, exam_date, hours_per_day, ratings jsonb, created_at), plan_tasks(id, plan_id, topic_id, scheduled_date, done boolean default false, is_revision boolean default false)
db.js exports: savePlan(plan, tasks) -> planId | loadPlan(planId) -> { plan, tasks } | setTaskDone(taskId, done) | loadTopics()
The plan ID is kept in localStorage under the key "az900_plan_id".

## Explain function (supabase/functions/explain)
POST body: { "topic": string, "domain": string, "language": "en" | "sw" }
Response:  { "text": string, "source": "ai" }
On any error return HTTP 500. The frontend then shows the topic's fallback_explanation after a 10 second timeout, labelled "Showing offline explanation".
The LLM key is a Supabase secret named LLM_API_KEY.

## Pages (frontend)
index.html: exam date, hours per day (0.5 to 8), three 1-5 confidence sliders, English/Kiswahili toggle, unofficial footer
plan.html: countdown, overall progress, per-domain progress, tasks grouped by date with a done checkbox, a Learn link and an "Explain this simply" button

## Definition of done
Works on a phone. Footer says unofficial. No console errors. Plan generated for exam in 3 days AND in 60 days.
