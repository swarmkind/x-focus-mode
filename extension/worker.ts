import {
  CATEGORIES,
  base64url,
  createIdentity,
  signReport,
  RETENTION,
  tweetId,
  categoryList,
  record,
  type Category,
  type Report,
} from "../shared/protocol.ts";
import {
  SYSTEM_PROMPT,
  PROMPT_VERSION,
  parseAssessments,
  endpointURL,
  type Assessment,
  type Post,
} from "../shared/model.ts";
import { defaults, publicSettings, type Settings } from "../shared/settings.ts";
import {
  getReports,
  putReports,
  cleanReports,
  cacheStats,
  clearCommunity,
} from "./store.ts";
declare const TEST_ORIGIN: string;
interface LocalData {
  settings?: Settings;
  identity?: { publicKey: string; privateKey: JsonWebKey };
  revision?: number;
  credentials?: Record<string, string>;
  corrections?: Record<string, boolean>;
  rejections?: Record<string, Category>;
}
interface SessionData {
  assessments?: Record<string, Assessment>;
}
const trusted = chrome.runtime.getURL("");
const init = chrome.storage.local.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS",
});
let creating: Promise<void> | undefined;
let configPromise: Promise<Settings> | undefined;
async function settings() {
  await init;
  return (configPromise ??= chrome.storage.local
    .get<LocalData>("settings")
    .then((r) => ({
      ...defaults,
      ...r.settings,
      actions: { ...defaults.actions, ...r.settings?.actions },
    })));
}
async function offscreen() {
  if (
    (
      await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      })
    ).length
  )
    return;
  if (!creating)
    creating = chrome.offscreen
      .createDocument({
        url: "offscreen.html",
        reasons: [chrome.offscreen.Reason.WEB_RTC],
        justification:
          "Distribute signed community reports through opt-in bounded WebRTC connections.",
      })
      .finally(() => {
        creating = undefined;
      });
  await creating;
}
async function networkLifecycle() {
  const s = await settings();
  if (s.consent && s.seed && s.relay) {
    await offscreen();
    await chrome.runtime
      .sendMessage({ target: "offscreen", type: "configure", relay: s.relay })
      .catch(() => {});
  } else if (
    (
      await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      })
    ).length
  ) {
    await chrome.runtime
      .sendMessage({ target: "offscreen", type: "stop" })
      .catch(() => {});
    await chrome.offscreen.closeDocument();
  }
}
chrome.runtime.onInstalled.addListener(async (details) => {
  await init;
  await chrome.alarms.create("maintenance", { periodInMinutes: 30 });
  if (details.reason === "install") await chrome.runtime.openOptionsPage();
  await networkLifecycle();
});
chrome.runtime.onStartup.addListener(() => void networkLifecycle());
chrome.alarms.onAlarm.addListener(() => {
  void cleanReports();
  void networkLifecycle();
});
chrome.action.onClicked.addListener(
  () => void chrome.runtime.openOptionsPage(),
);
function contentSender(sender: chrome.runtime.MessageSender) {
  if (
    sender.id !== chrome.runtime.id ||
    sender.frameId !== 0 ||
    !sender.tab ||
    !sender.url
  )
    return false;
  const u = new URL(sender.url);
  return (
    u.origin === "https://x.com" || (TEST_ORIGIN && u.origin === TEST_ORIGIN)
  );
}
function pageSender(sender: chrome.runtime.MessageSender) {
  return (
    sender.id === chrome.runtime.id && sender.url === trusted + "options.html"
  );
}
function offscreenSender(sender: chrome.runtime.MessageSender) {
  return (
    sender.id === chrome.runtime.id && sender.url === trusted + "offscreen.html"
  );
}
async function permitted(url: URL) {
  if (!(await chrome.permissions.contains({ origins: [url.origin + "/*"] })))
    throw new Error("Grant access to the configured service in settings");
}
const requests = new Set<AbortController>();
export async function fetchJSON(
  url: URL,
  options: RequestInit = {},
  limit = 100_000,
  expected?: Settings,
) {
  await permitted(url);
  if (expected && expected !== (await settings()))
    throw new Error("Settings changed");
  const controller = new AbortController();
  requests.add(controller);
  try {
    const response = await fetch(url, {
      ...options,
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(15_000),
        ...(options.signal ? [options.signal] : []),
      ]),
    });
    if (!response.ok) throw new Error(`Service returned ${response.status}`);
    if (Number(response.headers.get("content-length")) > limit)
      throw new Error("Response too large");
    const reader = response.body!.getReader();
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > limit) throw new Error("Response too large");
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel();
    }
    return JSON.parse(text);
  } finally {
    requests.delete(controller);
  }
}
function relayURL(raw: string) {
  return TEST_ORIGIN && raw === TEST_ORIGIN ? new URL(raw) : endpointURL(raw);
}
async function relay(path: string, body: unknown) {
  const s = await settings();
  if (!s.consent || !s.relay) throw new Error("No community relay configured");
  const url = relayURL(s.relay);
  url.pathname = path;
  return fetchJSON(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(path === "/v1/lookup" ? 600 : 15_000),
    },
    100_000,
    s,
  );
}
const checked = new Map<string, number>();
type LookupJob = { id: string; s: Settings; resolve: () => void };
const lookups: LookupJob[] = [];
let lookupActive = 0,
  lookupScheduled = false;
function primary(id: string, s: Settings): Promise<void> {
  if (lookups.length >= 32) return Promise.resolve();
  const work = new Promise<void>((resolve) => lookups.push({ id, s, resolve }));
  if (!lookupScheduled) {
    lookupScheduled = true;
    setTimeout(flushLookups, 20);
  }
  return Promise.race([
    work,
    new Promise<void>((resolve) => setTimeout(resolve, 650)),
  ]);
}
function flushLookups() {
  lookupScheduled = false;
  while (lookupActive < 4 && lookups.length) {
    const first = lookups.shift()!,
      batch = [first];
    while (batch.length < 4 && lookups[0]?.s === first.s)
      batch.push(lookups.shift()!);
    lookupActive++;
    void (async () => {
      if (first.s !== (await settings())) return;
      const result = await relay("/v1/lookup", {
        ids: [...new Set(batch.map((j) => j.id))],
      });
      if (record(result) && Array.isArray(result.reports)) {
        await putReports(result.reports);
        for (const job of batch)
          checked.set(job.s.relay + ":" + job.id, Date.now());
        while (checked.size > 500) checked.delete(checked.keys().next().value!);
      }
    })()
      .catch(() => {})
      .finally(() => {
        for (const job of batch) job.resolve();
        lookupActive--;
        flushLookups();
      });
  }
}
async function lookup(id: string): Promise<Report[]> {
  const s = await settings();
  if (!s.consent || !s.relay) return [];
  const cached = await getReports([id]);
  const checkKey = s.relay + ":" + id,
    last = checked.get(checkKey) || 0;
  if (cached.length && Date.now() - last < 5 * 60_000) return cached;
  if (s.seed) {
    await networkLifecycle();
    const peer = await Promise.race([
      chrome.runtime
        .sendMessage({ target: "offscreen", type: "lookup", ids: [id] })
        .catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 300)),
    ]);
    if (peer?.reports?.length && (!last || Date.now() - last < 30 * 60_000)) {
      checked.set(checkKey, last || Date.now());
      if (checked.size > 500) checked.delete(checked.keys().next().value!);
      return getReports([id]);
    }
  }
  await primary(id, s);
  return getReports([id]);
}
let identityPromise:
  | Promise<{ publicKey: string; privateKey: JsonWebKey }>
  | undefined;
async function identity() {
  return (identityPromise ??= (async () => {
    const r = await chrome.storage.local.get<LocalData>("identity");
    if (r.identity) return r.identity;
    const id = await createIdentity();
    await chrome.storage.local.set({ identity: id });
    return id;
  })());
}
let publishChain = Promise.resolve();
async function publish(
  id: string,
  categories: Category[],
  source: "human" | "model",
  model: string,
  withdrawn = false,
) {
  const operation = publishChain.then(async () => {
    const s = await settings();
    if (!s.consent || !s.share || !s.relay) return false;
    if (
      source === "model" &&
      (await chrome.storage.local.get<LocalData>("corrections")).corrections?.[
        id
      ]
    )
      return false;
    const signer = await identity();
    const previous = (await getReports([id])).find(
      (r) => r.publisher === signer.publicKey,
    );
    if (source === "model" && previous?.source === "human") return false;
    if (
      previous &&
      previous.withdrawn === withdrawn &&
      previous.source === source &&
      previous.model === model &&
      previous.categories.join() === categories.join() &&
      previous.expiresAt > Date.now() + 24 * 60 * 60_000
    )
      return true;
    const stored = await chrome.storage.local.get<LocalData>("revision");
    const now = Date.now();
    const revision = Math.max(now, (stored.revision || 0) + 1);
    await chrome.storage.local.set({ revision });
    const report = await signReport(
      {
        v: 1,
        tweetId: id,
        categories: withdrawn ? [] : categories,
        source,
        model,
        publisher: signer.publicKey,
        revision,
        issuedAt: now,
        expiresAt: now + RETENTION,
        withdrawn,
      },
      signer.privateKey,
    );
    await relay("/v1/report", report);
    await putReports([report]);
    return true;
  });
  publishChain = operation.then(
    () => {},
    () => {},
  );
  return operation;
}
type Job = {
  post: Post;
  s: Settings;
  key: string;
  resolve: (a: Assessment | undefined) => void;
};
const queue: Job[] = [];
let running = false;
const pending = new Map<string, Promise<Assessment | undefined>>();
async function classify(
  post: Post,
  s: Settings,
): Promise<Assessment | undefined> {
  if (s.mode === "community" || !s.model) return;
  const key = base64url(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        JSON.stringify([
          post.id,
          post.text,
          post.contextIncomplete,
          s.provider,
          s.mode,
          s.model,
          PROMPT_VERSION,
          s.interests,
        ]),
      ),
    ),
  );
  const cache = await chrome.storage.session.get<SessionData>("assessments");
  if (cache.assessments?.[key]) return cache.assessments[key];
  if (pending.has(key)) return pending.get(key);
  if (queue.length >= 48) return;
  const promise = new Promise<Assessment | undefined>((resolve) =>
    queue.push({ post, s, key, resolve }),
  );
  pending.set(key, promise);
  if (!running) {
    running = true;
    setTimeout(() => void drain(), 25);
  }
  return promise;
}
async function drain() {
  while (queue.length) {
    const first = queue.shift()!;
    if (first.s !== (await settings())) {
      first.resolve(undefined);
      pending.delete(first.key);
      continue;
    }
    const jobs = [first];
    while (jobs.length < 4 && queue[0]?.s === first.s)
      jobs.push(queue.shift()!);
    try {
      const s = first.s,
        url = endpointURL(s.provider, s.mode === "ollama");
      const keys = await chrome.storage.local.get<LocalData>("credentials");
      const token = s.mode === "api" ? keys.credentials?.[s.provider] : "";
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            interests: s.interests,
            posts: jobs.map((j) => j.post),
          }),
        },
      ];
      const body =
        s.mode === "ollama"
          ? {
              model: s.model,
              messages,
              stream: false,
              think: false,
              format: "json",
              options: { temperature: 0, num_ctx: 4096, num_predict: 700 },
            }
          : {
              model: s.model,
              messages,
              temperature: 0,
              max_tokens: 700,
              response_format: { type: "json_object" },
            };
      const data = await fetchJSON(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        },
        100_000,
        s,
      );
      const content =
        s.mode === "ollama"
          ? data.message?.content
          : data.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("No model response");
      const results = parseAssessments(
        content,
        jobs.map((j) => j.post),
      );
      const old =
        (await chrome.storage.session.get<SessionData>("assessments"))
          .assessments || {};
      for (const job of jobs) {
        const a = results.get(job.post.id)!;
        old[job.key] = a;
        job.resolve(a);
      }
      const entries = Object.entries(old);
      await chrome.storage.session.set({
        assessments: Object.fromEntries(entries.slice(-500)),
      });
    } catch {
      for (const job of jobs) job.resolve(undefined);
    }
    for (const job of jobs) pending.delete(job.key);
  }
  running = false;
}
async function oauth() {
  await permitted(new URL("https://openrouter.ai"));
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32))),
    state = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const challenge = base64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  const callback = chrome.identity.getRedirectURL("openrouter");
  const auth = new URL("https://openrouter.ai/auth");
  auth.search = new URLSearchParams({
    callback_url: callback,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }).toString();
  const returned = await chrome.identity.launchWebAuthFlow({
    url: auth.href,
    interactive: true,
  });
  if (!returned) throw new Error("Sign-in cancelled");
  const url = new URL(returned);
  if (
    url.origin !== new URL(callback).origin ||
    url.pathname !== new URL(callback).pathname ||
    url.searchParams.get("state") !== state ||
    !url.searchParams.get("code")
  )
    throw new Error("Invalid sign-in callback");
  const data = await fetchJSON(
    new URL("https://openrouter.ai/api/v1/auth/keys"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: url.searchParams.get("code"),
        code_verifier: verifier,
        code_challenge_method: "S256",
      }),
    },
  );
  if (typeof data.key !== "string" || data.key.length > 1024)
    throw new Error("Invalid provider key");
  const saved = await chrome.storage.local.get<LocalData>("credentials");
  await chrome.storage.local.set({
    credentials: {
      ...saved.credentials,
      ["https://openrouter.ai/api/v1/chat/completions"]: data.key,
    },
  });
  return { status: "OpenRouter connected" };
}
async function save(value: unknown, token: unknown) {
  if (
    !record(value) ||
    Object.keys(value).length !== Object.keys(defaults).length
  )
    throw new Error("Invalid settings");
  const s = value as unknown as Settings;
  if (
    !["api", "ollama", "community"].includes(s.mode) ||
    typeof s.model !== "string" ||
    s.model.length > 96 ||
    /[^\x20-\x7E]/.test(s.model) ||
    typeof s.downvoteColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(s.downvoteColor) ||
    typeof s.interests !== "string" ||
    s.interests.length > 1000 ||
    !["consent", "seed", "share", "communityBlur"].every(
      (k) => typeof value[k] === "boolean",
    ) ||
    !record(s.actions) ||
    Object.keys(s.actions).length !== 4 ||
    !CATEGORIES.every((c) =>
      ["blur", "colour", "ignore"].includes(s.actions[c]),
    )
  )
    throw new Error("Invalid settings values");
  if (
    typeof s.provider !== "string" ||
    typeof s.relay !== "string" ||
    s.provider.length > 1024 ||
    s.relay.length > 1024
  )
    throw new Error("Invalid service URL");
  if (s.mode !== "community")
    await permitted(endpointURL(s.provider, s.mode === "ollama"));
  if (s.relay) {
    const url = relayURL(s.relay);
    if (url.pathname !== "/" || url.search)
      throw new Error("Relay must be an HTTPS origin");
    await permitted(url);
    s.relay = url.origin;
  }
  const stored = await chrome.storage.local.get<LocalData>("credentials");
  let credentials = stored.credentials || {};
  if (typeof token === "string" && token.length) {
    if (token.length > 1024) throw new Error("API key too long");
    credentials = { ...credentials, [s.provider]: token };
  }
  await chrome.storage.local.set({ settings: s, credentials });
  configPromise = Promise.resolve(s);
  for (const controller of requests) controller.abort();
  await chrome.storage.session.remove("assessments");
  await networkLifecycle();
  for (const tab of await chrome.tabs.query({ url: "https://x.com/*" }))
    if (tab.id)
      void chrome.tabs
        .sendMessage(tab.id, { type: "settings-changed" })
        .catch(() => {});
  return { status: "Settings saved" };
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!record(msg) || msg.target === "offscreen") return;
  const content = contentSender(sender),
    page = pageSender(sender),
    screen = offscreenSender(sender);
  if (!content && !page && !screen) return;
  (async () => {
    if (msg.type === "settings" && (content || page)) {
      const s = await settings();
      return content ? publicSettings(s) : s;
    }
    if (page) {
      if (msg.type === "save") return save(msg.settings, msg.token);
      if (msg.type === "oauth") return oauth();
      if (msg.type === "status") {
        const s = await settings(),
          keys = await chrome.storage.local.get<LocalData>("credentials");
        return {
          hasKey: !!keys.credentials?.[s.provider],
          cache: await cacheStats(),
          network: await chrome.runtime
            .sendMessage({ target: "offscreen", type: "status" })
            .catch(() => ({ peers: 0 })),
        };
      }
      if (msg.type === "clear") {
        await clearCommunity();
        await chrome.storage.session.clear();
        return { status: "Cached reports and assessments cleared" };
      }
      if (msg.type === "disconnect") {
        await chrome.storage.local.remove("credentials");
        return { status: "Provider credentials removed" };
      }
    }
    if (screen && msg.type === "network-config") {
      const s = await settings();
      return { enabled: s.consent && s.seed, relay: s.relay };
    }
    if (
      !content ||
      !/^\/home$|^\/[A-Za-z0-9_]{1,15}\/status\/\d+$/.test(
        new URL(sender.url!).pathname,
      )
    )
      throw new Error("Unknown message");
    const s = await settings();
    if (!s.consent)
      return { reports: [], status: "Enable X Focus Mode in settings" };
    if (msg.type === "inspect") {
      const p = msg.post;
      if (
        !record(p) ||
        !tweetId(p.id) ||
        typeof p.text !== "string" ||
        p.text.length > 6000 ||
        typeof p.contextIncomplete !== "boolean" ||
        typeof p.eligible !== "boolean"
      )
        throw new Error("Invalid post");
      const post: Post = {
        id: p.id,
        text: p.text,
        contextIncomplete: p.contextIncomplete,
      };
      const eligible = p.eligible && new URL(sender.url!).pathname === "/home";
      const [reports, assessment] = await Promise.all([
        lookup(post.id),
        msg.detail === true
          ? undefined
          : eligible || s.mode === "ollama"
            ? classify(post, s)
            : undefined,
      ]);
      const feedback = await chrome.storage.local.get<LocalData>(["corrections", "rejections"]);
      const correction = feedback.corrections?.[post.id] === true;
      const rejection = feedback.rejections?.[post.id];
      if (eligible && assessment?.categories.length && !correction && s.share)
        void publish(post.id, assessment.categories, "model", s.model).catch(
          () => {},
        );
      return {
        reports,
        assessment,
        correction,
        rejection: rejection && categoryList([rejection]) ? rejection : undefined,
        status:
          s.mode === "community"
            ? "No community report"
            : !eligible && s.mode === "api"
              ? "Unreviewed · public visibility unconfirmed"
              : assessment
                ? undefined
                : "Unreviewed · model unavailable or not configured",
      };
    }
    if (msg.type === "reveal") return { status: "Revealed locally" };
    if (msg.type === "feedback") {
      if (
        !tweetId(msg.id) ||
        typeof msg.accurate !== "boolean" ||
        typeof msg.eligible !== "boolean" ||
        !categoryList([msg.category])
      )
        throw new Error("Invalid feedback");
      // The trusted content script supplies current visibility; worker memory may be suspended.
      const eligible = msg.eligible && new URL(sender.url!).pathname === "/home";
      const saved = await chrome.storage.local.get<LocalData>(["corrections", "rejections"]);
      const corrections = { ...saved.corrections, [msg.id]: !msg.accurate };
      const rejections = { ...saved.rejections };
      if (msg.accurate) rejections[msg.id] = msg.category as Category;
      else delete rejections[msg.id];
      await chrome.storage.local.set({
        rejections: Object.fromEntries(Object.entries(rejections).slice(-1000)),
        corrections: Object.fromEntries(
          Object.entries(corrections).slice(-1000),
        ),
      });
      if (eligible && s.share && s.relay) {
        try {
          await publish(
            msg.id,
            [msg.category as Category],
            "human",
            "",
            !msg.accurate,
          );
          return {
            status: msg.accurate
              ? "Signed human report published"
              : "Your report withdrawn; local correction saved",
          };
        } catch {
          return {
            status: "Saved locally; relay unavailable, nothing published",
          };
        }
      }
      return { status: "Feedback saved on this device" };
    }
    throw new Error("Unknown message");
  })().then(sendResponse, () =>
    sendResponse({
      error:
        "Request could not be completed. Check settings and service access.",
    }),
  );
  return true;
});
void init.then(networkLifecycle);
