// STUB explain client. Returns fake text after a short delay. No network, no key.
// Contract response shape: { text: string, source: "ai" }
//
// Test switches (add to the plan page URL):
//   ?stub=explain-fail   throws, like an HTTP 500, so you see the offline fallback
//   ?stub=explain-slow   takes 15 s, so you can watch the 10-second timeout fire

const mode = () => new URLSearchParams(window.location.search).get("stub");

/** Wait `ms`, but stop early (reject) if the AbortSignal fires. */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); });
  });
}

export async function explainTopic({ topic, domain, language }, signal) {
  await sleep(mode() === "explain-slow" ? 15000 : 900, signal);
  if (mode() === "explain-fail") throw new Error("explain failed: 500");

  const text = language === "sw"
    ? `(Jibu la majaribio) ${topic} ni sehemu ya "${domain}". Fikiria kama duka la mtaani: unalipia unachotumia tu. Verify on Microsoft Learn: ${topic}`
    : `(Stub answer) "${topic}" belongs to "${domain}". Think of a neighbourhood shop: you only pay for what you actually use. This is placeholder text so you can test the modal. Verify on Microsoft Learn: ${topic}`;

  return { text, source: "ai" };
}
