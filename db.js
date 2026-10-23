// STUB db.js. Same exports as CONTRACT.md, but it saves to localStorage instead of Supabase,
// so the plan survives a page reload while you test the UI.
//
// Test switches (add to the page URL):  ?stub=db-fail   loadPlan throws
//                                       ?stub=save-fail setTaskDone throws

const STORE_KEY = "az900_stub_db";
const LATENCY_MS = 250; // fake network delay so loading states are visible

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mode = () => new URLSearchParams(window.location.search).get("stub");

// ---------- Fake topics (same shape as data/topics.csv) ----------
const RAW = [
  ["Cloud Concepts", [
    ["What is cloud computing", 30], ["Benefits of the cloud (scalability, elasticity, reliability)", 45],
    ["CapEx vs OpEx and consumption-based pricing", 40], ["Shared responsibility model", 45],
    ["Public, private and hybrid cloud", 40], ["IaaS, PaaS and SaaS", 45],
  ]],
  ["Azure Architecture and Services", [
    ["Regions and availability zones", 40], ["Resource groups and subscriptions", 35],
    ["Virtual machines and scale sets", 50], ["App Service and containers", 50],
    ["Storage accounts and redundancy", 50], ["Virtual networks and VPN", 55],
    ["Microsoft Entra ID and authentication", 50], ["Zero trust and defence in depth", 40],
  ]],
  ["Azure Management and Governance", [
    ["Cost management and the pricing calculator", 40], ["Tags, Azure Policy and resource locks", 50],
    ["Role-based access control (RBAC)", 45], ["Azure Monitor and Service Health", 45],
    ["Azure Resource Manager, CLI and PowerShell", 50], ["Compliance and trust resources", 35],
  ]],
];

// Only two topics have an offline explanation, so you can test both the "offline" and "unavailable" messages.
const FALLBACKS = {
  "What is cloud computing":
    "Cloud computing means renting computing power, storage and software over the internet instead of buying and running your own machines. Think of mobile money: you do not build a bank branch in your village, you use the agent network that already exists and pay only when you send or receive. Likewise, you use a provider's data centres, pay for what you use, and let them look after the hardware, power and security behind the scenes.",
  "Public, private and hybrid cloud":
    "A public cloud is like a busy town market: many traders share the same stalls, run by the market authority. A private cloud is like a shop you own and lock yourself, used only by your business. A hybrid cloud mixes both: you keep sensitive records in your own shop but sell extra stock at the market during the festive season. You choose based on control, cost and rules about where your data must live.",
};

const TOPICS = [];
for (const [domain, items] of RAW) {
  for (const [title, minutes] of items) {
    TOPICS.push({
      id: TOPICS.length + 1, domain, title,
      estimated_minutes: minutes,
      learn_url: "https://learn.microsoft.com/training/",
      fallback_explanation: FALLBACKS[title] || "",
    });
  }
}

// ---------- Tiny localStorage "database" ----------
function readStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { plans: {} }; } catch { return { plans: {} }; } }
function writeStore(store) { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }

/** loadTopics() -> array of topics */
export async function loadTopics() {
  await sleep(LATENCY_MS);
  return TOPICS.map((t) => ({ ...t }));
}

/**
 * savePlan(plan, tasks) -> planId
 *   plan:  { exam_date, hours_per_day, ratings }
 *   tasks: [{ topic_id, scheduled_date, is_revision }]
 */
export async function savePlan(plan, tasks) {
  await sleep(LATENCY_MS);
  const id = (crypto.randomUUID && crypto.randomUUID()) || `stub-${Date.now()}`;
  const store = readStore();
  store.plans[id] = {
    plan: { id, ...plan, created_at: new Date().toISOString() },
    tasks: tasks.map((t, i) => ({ id: `${id}-${i + 1}`, plan_id: id, done: false, ...t })),
  };
  writeStore(store);
  return id;
}

/** loadPlan(planId) -> { plan, tasks }  (tasks use the plan_tasks column names) */
export async function loadPlan(planId) {
  await sleep(LATENCY_MS);
  if (mode() === "db-fail") throw new Error("stub: simulated database failure");
  const found = readStore().plans[planId];
  if (!found) return null;
  return JSON.parse(JSON.stringify(found));
}

/** setTaskDone(taskId, done) */
export async function setTaskDone(taskId, done) {
  await sleep(120);
  if (mode() === "save-fail") throw new Error("stub: simulated save failure");
  const store = readStore();
  for (const entry of Object.values(store.plans)) {
    const task = entry.tasks.find((t) => t.id === taskId);
    if (task) { task.done = Boolean(done); writeStore(store); return; }
  }
  throw new Error("stub: task not found");
}
