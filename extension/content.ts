import { extract, route, type FeedPost, type Metadata } from "./adapter.ts";
import {
  CATEGORIES,
  LABELS,
  type Category,
  type Report,
} from "../shared/protocol.ts";
import type { FeedSettings } from "../shared/settings.ts";
import type { Assessment } from "../shared/model.ts";
let settings: FeedSettings | null = null;
const metadata = new Map<string, Metadata>();
const revealed = new Set<string>();
const active = new Map<HTMLElement, Card>();
const answers = new Map<string, Result>();
let currentPath = location.pathname;
type Result = {
  assessment?: Assessment;
  reports: Report[];
  status?: string;
  correction?: boolean;
};
type Card = {
  post: FeedPost;
  root: ShadowRoot;
  host: HTMLElement;
  article: HTMLElement;
  timer?: ReturnType<typeof setTimeout>;
  timedOut: boolean;
  revealed: boolean;
  hidden: HTMLElement[];
  manualHidden?: boolean;
  originalShadow: string;
  result?: Result;
};
const css = `:host{display:block!important;position:relative!important;font:13px/1.4 system-ui!important;color:#ddedeb!important;z-index:2}*{box-sizing:border-box} .bar{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:9px 12px;background:#152a2c;border:1px solid #375557;border-radius:10px;margin:8px 0}button,select{font:inherit;color:inherit;background:#203b3e;border:1px solid #5b787a;border-radius:6px;padding:4px 8px;cursor:pointer}button:hover,button:focus-visible{background:#385b60;outline:2px solid #a4d7bd} .label{flex:1} .muted{color:#b1c4c7} .good{border-color:#a4d7bd} .pending{color:#c5d6d7} .feedback{display:flex;gap:6px;align-items:center;flex-wrap:wrap}details{width:100%}summary{cursor:pointer}small{display:block}`;
function message<T = any>(data: unknown): Promise<T> {
  return chrome.runtime.sendMessage(data);
}
function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight;
}
function setHidden(card: Card, hidden: boolean) {
  for (const child of card.hidden) {
    child.style.removeProperty("filter");
    child.style.removeProperty("pointer-events");
    child.removeAttribute("inert");
  }
  card.hidden = [];
  if (!hidden) return;
  // Keep the extension controls outside the inaccessible/blurred native subtree.
  for (const child of card.article.children)
    if (child !== card.host && child instanceof HTMLElement) {
      card.hidden.push(child);
      child.style.filter = "blur(9px)";
      child.style.pointerEvents = "none";
      child.setAttribute("inert", "");
    }
}
function button(text: string, action: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    action();
  });
  return b;
}
function render(card: Card, pending = false) {
  if (!settings) return;
  const focusedControl = card.root.activeElement?.textContent;
  const r = card.result;
  const reports = (r?.reports || []).filter((x) => !x.withdrawn);
  const local = r?.assessment?.categories || [];
  const categories = [
    ...new Set([...local, ...reports.flatMap((x) => x.categories)]),
  ];
  const enabled = categories.filter((c) => settings!.actions[c] !== "ignore");
  const blur =
    enabled.some(
      (c) =>
        settings!.actions[c] === "blur" &&
        (local.includes(c) ||
          (settings!.communityBlur &&
            reports.some((x) => x.categories.includes(c)))),
    ) && !r?.correction;
  card.article.style.boxShadow = enabled.length
    ? "inset 3px 0 #b6a16e"
    : r?.assessment?.relevant
      ? "inset 3px 0 #a4d7bd"
      : "";
  const shouldHide =
    (pending || blur || !!card.manualHidden) &&
    !card.revealed &&
    !(card.timedOut && visible(card.article));
  setHidden(card, shouldHide);
  card.root.replaceChildren();
  const style = document.createElement("style");
  style.textContent = css;
  card.root.append(style);
  const bar = document.createElement("div");
  bar.className = "bar" + (r?.assessment?.relevant ? " good" : "");
  bar.tabIndex = -1;
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "X Focus Mode");
  const label = document.createElement("span");
  label.className = "label";
  label.setAttribute("role", "status");
  const human = reports.filter((x) => x.source === "human").length,
    models = reports.filter((x) => x.source === "model").length;
  label.textContent = pending
    ? "Checking this post…"
    : enabled.length
      ? enabled.map((c) => LABELS[c]).join(" · ")
      : r?.assessment?.relevant
        ? "Matches your interests"
        : r?.assessment?.confidence === "clear"
          ? "Reviewed · no filter applied"
          : r?.correction
            ? "Your correction · shown"
            : r?.status || "Unreviewed";
  if (human || models) {
    const count = document.createElement("small");
    count.textContent = `Community: ${human} human report${human === 1 ? "" : "s"}, ${models} model assessment${models === 1 ? "" : "s"} · unverified claims`;
    label.append(count);
  }
  bar.append(label);
  if (shouldHide)
    bar.append(
      button("Reveal", () => {
        revealed.add(card.post.id);
        if (revealed.size > 1000)
          revealed.delete(revealed.values().next().value!);
        card.revealed = true;
        card.manualHidden = false;
        clearTimeout(card.timer);
        card.timedOut = true;
        render(card);
        void message({ type: "reveal", id: card.post.id }).catch(() => {});
      }),
    );
  else if (enabled.length)
    bar.append(
      button("Hide", () => {
        revealed.delete(card.post.id);
        card.revealed = false;
        card.manualHidden = true;
        card.timedOut = false;
        render(card);
      }),
    );
  if (!pending) {
    const details = document.createElement("details"),
      summary = document.createElement("summary");
    summary.textContent = "Feedback";
    details.append(summary);
    const feedback = document.createElement("div");
    feedback.className = "feedback";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Report category");
    for (const c of CATEGORIES) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = LABELS[c];
      select.append(o);
    }
    if (enabled[0]) select.value = enabled[0];
    const note = document.createElement("small");
    note.textContent =
      card.post.eligible && settings.share
        ? "Your confirmation may publish a signed human report."
        : "Feedback stays on this device; sharing eligibility is not established.";
    async function submit(accurate: boolean) {
      const response = await message({
        type: "feedback",
        id: card.post.id,
        category: select.value,
        accurate,
      }).catch(() => ({ error: "Feedback could not be saved" }));
      note.textContent = response.error || response.status;
      if (!accurate) {
        card.revealed = true;
        card.manualHidden = false;
        revealed.add(card.post.id);
        card.result = {
          ...card.result,
          reports: reports,
          correction: true,
          assessment: undefined,
        };
        setHidden(card, false);
      }
    }
    feedback.append(
      select,
      button("Accurate", () => void submit(true)),
      button("Incorrect", () => void submit(false)),
      note,
    );
    details.append(feedback);
    bar.append(details);
  }
  card.root.append(bar);
  if (focusedControl === "Reveal" || focusedControl === "Hide") {
    const buttons = [
      ...card.root.querySelectorAll<HTMLButtonElement>("button"),
    ];
    (
      buttons.find((b) => b.textContent === focusedControl) ||
      buttons.find(
        (b) => b.textContent === "Reveal" || b.textContent === "Hide",
      ) ||
      bar
    ).focus({ preventScroll: true });
  }
}
async function inspect(article: HTMLElement) {
  if (!settings?.consent) return;
  const viewer =
    document
      .querySelector<HTMLAnchorElement>(
        'a[data-testid="AppTabBar_Profile_Link"]',
      )
      ?.getAttribute("href")
      ?.match(/^\/([A-Za-z0-9_]{1,15})$/)?.[1] || "";
  const post = extract(article, metadata, viewer);
  const old = active.get(article);
  if (!post) {
    if (old) remove(old);
    return;
  }
  if (old?.post.id === post.id && old.host.isConnected) {
    if (old.post.eligible === post.eligible) {
      old.post = post;
      if (
        old.hidden.length &&
        (old.hidden.some((el) => el.parentElement !== article) ||
          article.children.length !== old.hidden.length + 1)
      )
        render(old);
      return;
    }
    answers.delete(post.id);
  }
  if (old) remove(old);
  const host = document.createElement("div");
  host.dataset.xfm = "";
  const root = host.attachShadow({ mode: "open" });
  article.prepend(host);
  const card: Card = {
    post,
    root,
    host,
    article,
    timedOut: false,
    revealed: revealed.has(post.id),
    hidden: [],
    originalShadow: article.style.boxShadow,
  };
  active.set(article, card);
  const cached = answers.get(post.id);
  if (cached) {
    card.result = cached;
    render(card);
    return;
  }
  render(card, true);
  card.timer = setTimeout(() => {
    card.timedOut = true;
    render(card);
  }, 1000);
  try {
    const result = await message<Result>({
      type: "inspect",
      post,
      detail: route(location.pathname) === "detail",
    });
    if (
      !result ||
      active.get(article) !== card ||
      location.pathname !== currentPath
    )
      return;
    card.result = result;
    answers.set(post.id, result);
    if (answers.size > 500) answers.delete(answers.keys().next().value!);
    clearTimeout(card.timer);
    render(card);
  } catch {
    clearTimeout(card.timer);
    card.timedOut = true;
    card.result = {
      reports: [],
      status: "Unreviewed · connection unavailable",
    };
    render(card);
  }
}
function remove(card: Card) {
  card.article.style.boxShadow = card.originalShadow;
  clearTimeout(card.timer);
  setHidden(card, false);
  card.host.remove();
  active.delete(card.article);
}
const ahead = new IntersectionObserver(
  (entries) => {
    for (const e of entries)
      if (e.isIntersecting) void inspect(e.target as HTMLElement);
  },
  { rootMargin: `0px 0px ${innerHeight * 2}px 0px` },
);
const observed = new WeakSet<Element>();
let scheduled = false;
function scan() {
  scheduled = false;
  if (location.pathname !== currentPath) {
    currentPath = location.pathname;
    for (const card of active.values()) remove(card);
  }
  for (const card of active.values())
    if (!card.article.isConnected) {
      ahead.unobserve(card.article);
      observed.delete(card.article);
      remove(card);
    }
  if (route(location.pathname) === "excluded") return;
  for (const el of document.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]',
  )) {
    if (!observed.has(el)) {
      observed.add(el);
      ahead.observe(el);
    }
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight * 3) void inspect(el);
  }
}
const observer = new MutationObserver((records) => {
  if (
    records.every(
      (r) => r.target instanceof Element && r.target.closest("[data-xfm]"),
    )
  )
    return;
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(scan);
  }
});
window.addEventListener("message", (event) => {
  if (
    !settings?.consent ||
    event.source !== window ||
    event.origin !== location.origin ||
    event.data?.type !== "xfm-public-metadata-v1" ||
    !Array.isArray(event.data.posts)
  )
    return;
  for (const p of event.data.posts.slice(0, 100))
    if (
      p &&
      /^\d{1,20}$/.test(p.id) &&
      typeof p.author === "string" &&
      /^[A-Za-z0-9_]{1,15}$/.test(p.author) &&
      typeof p.public === "boolean"
    )
      metadata.set(p.id, { author: p.author, public: p.public });
  if (metadata.size > 1000)
    for (const key of [...metadata.keys()].slice(0, 500)) metadata.delete(key);
  scan();
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "settings-changed") {
    for (const card of active.values()) remove(card);
    answers.clear();
    void init();
  }
});
async function init() {
  settings = await message({ type: "settings" }).catch(() => null);
  if (!settings?.consent) metadata.clear();
  window.postMessage(
    { type: "xfm-metadata-enabled", enabled: !!settings?.consent },
    location.origin,
  );
  scan();
}
observer.observe(document, { childList: true, subtree: true });
void init();
