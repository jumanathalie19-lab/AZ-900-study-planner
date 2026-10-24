// explain-client.js (UNOFFICIAL AZ-900 Study Planner)
// Calls the real Supabase Edge Function "explain" (see CONTRACT.md).
// Replaces the stub in stubs/explain.js. Same signature, so app.js needs only one import change.
//
// The publishable key is meant to be public (it is safe in the browser).
// NEVER put the Gemini key (LLM_API_KEY), an sb_secret_ key or the service_role key in this file.
//
// If db.js already holds your Supabase URL and publishable key, use the same values here.

const SUPABASE_URL = "https://jnakgmrrextqqtyjixqk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_JssEjjP5gxa3qQ9f84Q0kQ_CERzmhx-";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/explain`;

/**
 * @param {{ topic: string, domain: string, language: "en" | "sw" }} request
 * @param {AbortSignal} [signal] app.js aborts this after 10 seconds
 * @returns {Promise<{ text: string, source: string }>}
 * Throws on ANY problem, so app.js can show the topic's offline fallback_explanation.
 */
export async function explainTopic({ topic, domain, language }, signal) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ topic, domain, language }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`explain returned HTTP ${res.status}`);
  }

  const data = await res.json();
  if (typeof data?.text !== "string" || data.text.trim() === "") {
    throw new Error("explain returned no text");
  }
  return { text: data.text, source: data.source ?? "ai" };
}
