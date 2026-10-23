// db.js: Supabase save/load helpers. Owner: Person 2. See CONTRACT.md.
//
// The Supabase URL and the *anon public* key are designed to be public in browser code
// (the policies in schema.sql control what they can do). NEVER paste the service_role key
// here, and never put the LLM key in this file.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://jnakgmrrextqqtyjixqk.supabase.co";      // e.g. https://abcdxyz.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_JssEjjP5gxa3qQ9f84Q0kQ_CERzmhx-";

const PLAN_ID_KEY = "az900_plan_id";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function fail(action, error) {
  console.error(`[db] ${action} failed:`, error);
  throw new Error(`${action} failed: ${error.message || error}`);
}

/**
 * Save a new plan and its tasks. Remembers the plan id in localStorage.
 * @param {{exam_date: string, hours_per_day: number, ratings: object}} plan
 * @param {Array<{date: string, topicId: number, isRevision: boolean}>} tasks  (output of generatePlan)
 * @returns {Promise<string>} planId
 */
export async function savePlan(plan, tasks) {
  const { data, error } = await supabase
    .from("plans")
    .insert({
      exam_date: plan.exam_date,
      hours_per_day: plan.hours_per_day,
      ratings: plan.ratings,
    })
    .select("id")
    .single();
  if (error) fail("Saving the plan", error);

  const planId = data.id;
  // Accepts BOTH shapes: column-shaped { topic_id, scheduled_date, is_revision }
  // (what app.js sends) and planner-shaped { topicId, date, isRevision }.
  const rows = tasks.map((t) => ({
    plan_id: planId,
    topic_id: Number(t.topic_id ?? t.topicId),
    scheduled_date: t.scheduled_date ?? t.date,
    is_revision: !!(t.is_revision ?? t.isRevision),
  }));

  if (rows.length > 0) {
    const { error: taskError } = await supabase.from("plan_tasks").insert(rows);
    if (taskError) {
      await supabase.from("plans").delete().eq("id", planId); // may be blocked by policy; harmless
      fail("Saving the plan tasks", taskError);
    }
  }

  try { localStorage.setItem(PLAN_ID_KEY, planId); } catch (e) { /* private mode: ignore */ }
  return planId;
}

/**
 * Load a plan and its tasks (each task includes its topic details as task.topic).
 * Uses the id saved in localStorage if none is passed. Returns null if there is no plan.
 * @returns {Promise<{plan: object, tasks: Array<object>} | null>}
 */
export async function loadPlan(planId) {
  let id = planId;
  if (!id) {
    try { id = localStorage.getItem(PLAN_ID_KEY); } catch (e) { id = null; }
  }
  // A stale id from the stub db (or anything that is not a UUID) would make Postgres error out.
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;

  const { data: plan, error } = await supabase.from("plans").select("*").eq("id", id).maybeSingle();
  if (error) fail("Loading the plan", error);
  if (!plan) return null; // stale id

  const { data: rows, error: taskError } = await supabase
    .from("plan_tasks")
    .select("id, plan_id, topic_id, scheduled_date, done, is_revision, topics(*)")
    .eq("plan_id", id)
    .order("scheduled_date", { ascending: true })
    .order("id", { ascending: true });
  if (taskError) fail("Loading the plan tasks", taskError);

  const tasks = rows.map(({ topics, ...task }) => ({ ...task, topic: topics }));
  return { plan, tasks };
}

/** Tick or untick a task. */
export async function setTaskDone(taskId, done) {
  const { error } = await supabase.from("plan_tasks").update({ done: !!done }).eq("id", taskId);
  if (error) fail("Updating the task", error);
}

/** All topics, in id order. */
export async function loadTopics() {
  const { data, error } = await supabase.from("topics").select("*").order("id", { ascending: true });
  if (error) fail("Loading topics", error);
  return data;
}

/** Forget the saved plan on this device (for a "Start a new plan" button). */
export function clearSavedPlan() {
  try { localStorage.removeItem(PLAN_ID_KEY); } catch (e) { /* ignore */ }
}
