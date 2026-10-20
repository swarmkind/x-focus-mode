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
  rejection?: Category;
};
type Card = {
  post: FeedPost;
  root: ShadowRoot;
  host: HTMLElement;
  article: HTMLElement;
  actions: HTMLElement;
  overlay: HTMLElement;
  timer?: ReturnType<typeof setTimeout>;
  timedOut: boolean;
  revealed: boolean;
  hidden: {
    element: HTMLElement;
    filter: string;
    filterPriority: string;
    pointerEvents: string;
    pointerPriority: string;
    inert: string | null;
  }[];
  manualHidden?: boolean;
  originalShadow: string;
  originalPosition: string;
  originalPositionPriority: string;
  feedbackStatus?: string;
  feedbackVersion: number;
  saving?: boolean;
  result?: Result;
};
const css = `
:host{font:14px/1.4 system-ui;color:#182523;color-scheme:light dark}
*{box-sizing:border-box}button{font:inherit;cursor:pointer}button:focus-visible{outline:2px solid #3b8b70;outline-offset:2px}
:host::before{content:"";position:absolute;left:0;top:-10px;width:1px;height:20px;background:var(--xfm-icon,#414a53);opacity:.35;pointer-events:none}.control{display:contents}.trigger{position:absolute;left:14px;top:-17px;width:34px;height:34px;display:grid;place-items:center;padding:0;border:0;border-radius:6px;background:transparent;color:var(--xfm-icon,#414a53);font-size:20px;line-height:1;transition:color .12s}.trigger svg{width:20px;height:20px;display:block}
.trigger:hover,.trigger[aria-expanded=true]{opacity:.75}.trigger.flagged{color:#986622}
.badge{position:absolute;right:-2px;top:-2px;min-width:12px;height:12px;padding:0 2px;border-radius:8px;background:#9b6a16;color:white;font:9px/12px system-ui}
.menu{position:fixed;inset:auto;margin:0;padding:9px;width:266px;max-width:calc(100vw - 16px);border:1px solid #dce4df;border-radius:14px;background:#fff;color:#182523;box-shadow:0 8px 35px #0c211c24}
.menu::backdrop{background:transparent}.heading{font-weight:650;padding:5px 9px 8px}.label{padding:0 9px 8px;font-size:12px;color:#52645b}.item{display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;border-radius:7px;padding:9px;line-height:1.3}.item:hover,.item:focus-visible{background:#eef4f0}.divider{height:1px;background:#e4ebe7;margin:6px 0}.note{display:block;margin:7px 9px 4px;font-size:11px;color:#52645b}.menu button:disabled{opacity:.5;cursor:wait}
@media(prefers-color-scheme:dark){.trigger.flagged{color:#d5af79}.menu{background:#182523;color:#e4eee8;border-color:#40534a}.item:hover,.item:focus-visible{background:#2c4036}.label,.note{color:#b1c5b8}.divider{background:#40534a}}
`;
const overlayCss = `:host{position:absolute!important;inset:0 0 42px!important;display:grid!important;place-items:center!important;pointer-events:none!important;z-index:2!important}button{pointer-events:auto;font:600 13px/1.3 system-ui;color:#e8f2eb;background:#182e27ed;border:1px solid #8eae9b;border-radius:20px;padding:9px 15px;cursor:pointer;box-shadow:0 3px 14px #10291e24}button:focus-visible{outline:2px solid #8ed4ad;outline-offset:3px}`;
function message<T = any>(data: unknown): Promise<T> {
  return chrome.runtime.sendMessage(data);
}
function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight;
}
function blurTargets(card: Card) {
  const targets: HTMLElement[] = [];
  function visit(parent: HTMLElement) {
    for (const child of parent.children) {
      if (!(child instanceof HTMLElement) || child === card.actions || child === card.overlay) continue;
      if (child.contains(card.actions)) visit(child);
      else targets.push(child);
    }
  }
  visit(card.article);
  return targets;
}
function setHidden(card: Card, hidden: boolean) {
  for (const child of card.hidden) {
    child.element.style.setProperty("filter", child.filter, child.filterPriority);
    child.element.style.setProperty("pointer-events", child.pointerEvents, child.pointerPriority);
    if (child.inert === null) child.element.removeAttribute("inert");
    else child.element.setAttribute("inert", child.inert);
  }
  card.hidden = [];
  if (!hidden) return;
  // Keep X's action row usable while blurring the surrounding content branches.
  for (const child of blurTargets(card)) {
    card.hidden.push({ element: child, filter: child.style.getPropertyValue("filter"), filterPriority: child.style.getPropertyPriority("filter"), pointerEvents: child.style.getPropertyValue("pointer-events"), pointerPriority: child.style.getPropertyPriority("pointer-events"), inert: child.getAttribute("inert") });
    child.style.setProperty("filter", "blur(9px)", "important");
    child.style.setProperty("pointer-events", "none", "important");
    child.setAttribute("inert", "");
  }
}
function button(text: string, action: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.addEventListener("click", (e) => { e.stopPropagation(); action(); });
  return b;
}
function rememberReveal(card: Card) {
  revealed.add(card.post.id);
  if (revealed.size > 1000) revealed.delete(revealed.values().next().value!);
  card.revealed = true;
  card.manualHidden = false;
  clearTimeout(card.timer);
  card.timedOut = true;
}
function closeMenus(event: Event) {
  for (const card of active.values()) {
    const menu = card.root.querySelector<HTMLElement>(".menu:popover-open");
    const trigger = card.root.querySelector<HTMLElement>(".trigger");
    if (!menu || !trigger) continue;
    const rect = trigger.getBoundingClientRect();
    if (event.type === "resize" || menu.dataset.anchor !== `${rect.left},${rect.top}`) menu.hidePopover();
  }
}
function render(card: Card, pending = false) {
  if (!settings) return;
  const wasOpen = !!card.root.querySelector(".menu:popover-open");
  const focused = card.root.activeElement?.getAttribute("data-action");
  const revealFocused = !!card.overlay.shadowRoot?.activeElement;
  const r = card.result;
  const reports = (r?.reports || []).filter((x) => !x.withdrawn);
  const local = r?.rejection ? [r.rejection] : r?.assessment?.categories || [];
  const enabled = [...new Set([...local, ...reports.flatMap((x) => x.categories)])].filter((c) => settings!.actions[c] !== "ignore");
  const blur = !r?.correction && (r?.rejection || enabled.some((c) => settings!.actions[c] === "blur" && (local.includes(c) || (settings!.communityBlur && reports.some((x) => x.categories.includes(c))))));
  card.article.style.boxShadow = enabled.length ? "inset 2px 0 #b6a16e" : r?.assessment?.relevant ? "inset 2px 0 #a4d7bd" : card.originalShadow;
  const shouldHide = !!((pending || blur || card.manualHidden) && !card.revealed && !(card.timedOut && visible(card.article)));
  setHidden(card, shouldHide);
  card.root.replaceChildren();
  const style = document.createElement("style"); style.textContent = css; card.root.append(style);
  const control = document.createElement("div"); control.className = "control";
  control.setAttribute("role", "group"); control.setAttribute("aria-label", "X Focus Mode");
  for (const event of ["click", "pointerdown", "keydown"]) control.addEventListener(event, (e) => e.stopPropagation());
  const human = reports.filter((x) => x.source === "human").length, models = reports.filter((x) => x.source === "model").length;
  const status = pending ? "Checking this post…" : r?.correction ? "Your correction · shown" : r?.rejection ? `Rejected · ${LABELS[r.rejection]}` : enabled.length ? enabled.map((c) => LABELS[c]).join(" · ") : r?.assessment?.relevant ? "Matches your interests" : r?.assessment?.confidence === "clear" ? "Reviewed · no filter applied" : r?.status || "Unreviewed";
  const community = human || models ? `Community: ${human} human report${human === 1 ? "" : "s"}, ${models} model assessment${models === 1 ? "" : "s"} · unverified claims` : "";
  const menu = document.createElement("div"); menu.className = "menu"; menu.id = "reject-menu"; menu.setAttribute("popover", "auto"); menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Why reject this post?");
  function openMenu(focus = true) {
    menu.showPopover();
    const rect = trigger.getBoundingClientRect();
    menu.dataset.anchor = `${rect.left},${rect.top}`;
    menu.style.left = `${Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, rect.right - menu.offsetWidth))}px`;
    menu.style.top = `${Math.max(8, rect.bottom + menu.offsetHeight + 8 <= innerHeight ? rect.bottom + 6 : rect.top - menu.offsetHeight - 6)}px`;
    trigger.setAttribute("aria-expanded", "true");
    if (focus) menu.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }
  const trigger = button("", () => { if (menu.matches(":popover-open")) menu.hidePopover(); else openMenu(); });
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.8");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M16 3H6.5a2 2 0 0 0-1.96 1.61l-1.4 7A2 2 0 0 0 5.1 14H10l-1 5a2.5 2.5 0 0 0 2.5 2.5L16 14V3Zm0 0h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3");
  icon.append(path);
  trigger.append(icon);
  trigger.className = "trigger" + (enabled.length ? " flagged" : "");
  trigger.dataset.action = "trigger"; trigger.setAttribute("aria-label", "Reject post"); trigger.setAttribute("aria-description", status + (community ? `. ${community}` : ""));
  trigger.title = `${status}${community ? " · " + community : ""}`;
  trigger.setAttribute("aria-haspopup", "menu"); trigger.setAttribute("aria-expanded", "false"); trigger.setAttribute("aria-controls", menu.id);
  if (human || models) { const badge = document.createElement("span"); badge.className = "badge"; badge.setAttribute("aria-hidden", "true"); badge.textContent = String(human + models); trigger.append(badge); }
  menu.addEventListener("beforetoggle", (event) => trigger.setAttribute("aria-expanded", String((event as ToggleEvent).newState === "open")));
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); menu.hidePopover(); trigger.focus({ preventScroll: true }); }
    const items = [...menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const at = items.indexOf(card.root.activeElement as HTMLButtonElement);
    let next: number | undefined;
    if (event.key === "ArrowDown") next = (at + 1) % items.length;
    if (event.key === "ArrowUp") next = (at - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== undefined) { event.preventDefault(); items[next]?.focus(); }
    if (event.key === "Tab") menu.hidePopover();
  });
  const heading = document.createElement("div"); heading.className = "heading"; heading.textContent = "Less of this";
  const label = document.createElement("div"); label.className = "label"; label.textContent = status + (community ? `. ${community}` : "");
  menu.append(heading, label);
  function item(text: string, action: string, run: () => void) {
    const b = button(text, run); b.className = "item"; b.dataset.action = action; b.setAttribute("role", "menuitem"); menu.append(b); return b;
  }
  async function submit(category: Category, accurate: boolean) {
    if (card.saving) return;
    card.saving = true;
    card.feedbackVersion++;
    clearTimeout(card.timer);
    const previous = card.result;
    if (accurate) {
      card.result = { ...card.result, reports, rejection: category, correction: false };
      revealed.delete(card.post.id); card.revealed = false; card.manualHidden = true; card.timedOut = false;
    } else {
      rememberReveal(card); card.result = { ...card.result, reports, rejection: undefined, correction: true, assessment: undefined };
    }
    answers.set(card.post.id, card.result!);
    card.feedbackStatus = "Saving…";
    menu.hidePopover(); render(card); card.root.querySelector<HTMLButtonElement>(".trigger")?.focus({ preventScroll: true });
    const response = await message({ type: "feedback", id: card.post.id, eligible: card.post.eligible, category, accurate }).catch(() => ({ error: "Feedback could not be saved" }));
    if (active.get(card.article) !== card) return;
    card.saving = false;
    card.feedbackStatus = response.error || response.status;
    if (response.error) { card.result = previous; rememberReveal(card); if (previous) answers.set(card.post.id, previous); else answers.delete(card.post.id); }
    render(card);
    if (response.error) card.root.querySelector<HTMLButtonElement>(".trigger")?.click();
  }
  for (const category of CATEGORIES) item(LABELS[category], category, () => void submit(category, true)).disabled = !!card.saving;
  if (enabled.length || r?.rejection) {
    const divider = document.createElement("div"); divider.className = "divider"; menu.append(divider);
    item("Incorrect · show this post", "correct", () => void submit(enabled[0] || r!.rejection!, false)).disabled = !!card.saving;
    if (!shouldHide) item("Hide this post", "hide", () => { revealed.delete(card.post.id); card.revealed = false; card.manualHidden = true; card.timedOut = false; menu.hidePopover(); render(card); });
  }
  const note = document.createElement("small"); note.className = "note"; note.setAttribute("role", "status");
  note.textContent = card.feedbackStatus || (card.post.eligible && settings.share ? "Choosing a reason may share a signed human report." : "Saved only on this device. No public report will be sent."); menu.append(note);
  control.append(trigger, menu); card.root.append(control);
  const overlayRoot = card.overlay.shadowRoot!; overlayRoot.replaceChildren();
  card.overlay.style.display = shouldHide ? "" : "none";
  if (shouldHide) {
    const style = document.createElement("style"); style.textContent = overlayCss;
    const reveal = button("Reveal", () => { rememberReveal(card); render(card); card.root.querySelector<HTMLButtonElement>(".trigger")?.focus({ preventScroll: true }); void message({ type: "reveal", id: card.post.id }).catch(() => {}); });
    reveal.title = status; overlayRoot.append(style, reveal);
  }
  if (wasOpen) openMenu(false);
  if (focused) card.root.querySelector<HTMLButtonElement>(`[data-action="${focused}"]`)?.focus({ preventScroll: true });
  if (revealFocused && shouldHide) overlayRoot.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
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
  const reply = article.querySelector<HTMLElement>('[data-testid="reply"]');
  const actions = reply?.closest<HTMLElement>('[role="group"]');
  if (!post || !actions || !reply) {
    if (old) remove(old);
    return;
  }
  if (old?.post.id === post.id && old.host.parentElement === actions && old.overlay.isConnected) {
    if (old.post.eligible === post.eligible) {
      old.post = post;
      if (
        old.hidden.length &&
        (blurTargets(old).some((element, index) => old.hidden[index]?.element !== element) ||
          blurTargets(old).length !== old.hidden.length)
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
  host.style.cssText = "display:inline-flex!important;position:relative!important;flex:0 0 48px!important;width:48px!important;height:0!important;align-self:center!important;margin:0!important;margin-left:10px!important;padding:0!important";
  host.style.setProperty("--xfm-icon", getComputedStyle(reply.querySelector("svg") || reply).color);
  actions.append(host);
  const overlay = document.createElement("div");
  overlay.dataset.xfmOverlay = "";
  overlay.attachShadow({ mode: "open" });
  overlay.style.cssText = "position:absolute;inset:0 0 42px;pointer-events:none;z-index:2";
  article.append(overlay);
  const card: Card = {
    post,
    root,
    host,
    article,
    actions,
    overlay,
    timedOut: false,
    feedbackVersion: 0,
    revealed: revealed.has(post.id),
    hidden: [],
    originalShadow: article.style.boxShadow,
    originalPosition: article.style.getPropertyValue("position"),
    originalPositionPriority: article.style.getPropertyPriority("position"),
  };
  if (getComputedStyle(article).position === "static") article.style.setProperty("position", "relative");
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
    // A late model response must not overwrite an explicit rejection or correction.
    card.result = card.feedbackVersion ? { ...result, rejection: card.result?.rejection, correction: card.result?.correction } : result;
    answers.set(post.id, card.result);
    if (answers.size > 500) answers.delete(answers.keys().next().value!);
    clearTimeout(card.timer);
    render(card);
  } catch {
    clearTimeout(card.timer);
    card.timedOut = true;
    card.result = { ...card.result, reports: card.result?.reports || [], status: "Unreviewed · connection unavailable" };
    render(card);
  }
}
function remove(card: Card) {
  card.article.style.boxShadow = card.originalShadow;
  card.article.style.setProperty("position", card.originalPosition, card.originalPositionPriority);
  clearTimeout(card.timer);
  setHidden(card, false);
  card.host.remove();
  card.overlay.remove();
  active.delete(card.article);
}
window.addEventListener("scroll", closeMenus, { capture: true, passive: true });
window.addEventListener("resize", closeMenus);
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
      (r) => r.target instanceof Element && r.target.closest("[data-xfm],[data-xfm-overlay]"),
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
