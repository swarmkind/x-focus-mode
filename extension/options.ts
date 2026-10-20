import { CATEGORIES, LABELS } from "../shared/protocol.ts";
import { defaults, type Settings } from "../shared/settings.ts";
import { endpointURL } from "../shared/model.ts";
const $ = <T extends HTMLElement = HTMLInputElement>(id: string) =>
  document.getElementById(id) as T;
const status = $<HTMLOutputElement>("status");
for (const c of CATEGORIES) {
  const label = document.createElement("label");
  label.textContent = LABELS[c];
  const select = document.createElement("select");
  select.id = c;
  select.setAttribute("aria-label", LABELS[c]);
  for (const action of ["blur", "colour", "ignore"]) {
    const o = document.createElement("option");
    o.value = action;
    o.textContent = action[0].toUpperCase() + action.slice(1);
    select.append(o);
  }
  label.append(select);
  $("categories").append(label);
}
function modeChanged(changeEndpoint = false) {
  const mode = $<HTMLSelectElement>("mode").value;
  $("provider-fields").hidden = mode === "community";
  $("local-help").hidden = mode !== "ollama";
  $("oauth").hidden = mode !== "api";
  $("provider").required = mode !== "community";
  if (changeEndpoint)
    $("provider").value =
      mode === "ollama" ? "http://localhost:11434/api/chat" : defaults.provider;
}
async function refresh() {
  const r = await chrome.runtime.sendMessage({ type: "status" });
  $("connection").textContent = r?.hasKey
    ? "A key is stored for this endpoint."
    : "No key stored for this endpoint.";
  $("network-status").textContent =
    `${r?.network?.peers || 0} peers connected · ${Math.round((r?.cache?.bytes || 0) / 1024)} KB community cache`;
}
async function run(action: () => Promise<any>) {
  try {
    status.textContent = "Working…";
    const result = await action();
    if (result?.error) throw new Error(result.error);
    status.textContent = result?.status || "Saved";
    await refresh();
  } catch (e) {
    status.textContent =
      e instanceof Error ? e.message : "Could not complete request";
  }
}
async function grant(urls: URL[]) {
  if (!urls.length) return;
  const origins = [...new Set(urls.map((u) => u.origin + "/*"))];
  if (!(await chrome.permissions.request({ origins })))
    throw new Error("Service access was not granted");
}
$("settings").addEventListener("submit", (e) => {
  e.preventDefault();
  void run(async () => {
    const s: Settings = {
      consent: $("consent").checked,
      mode: $<HTMLSelectElement>("mode").value as Settings["mode"],
      provider: $("provider").value.trim(),
      model: $("model").value.trim(),
      interests: $<HTMLTextAreaElement>("interests").value.trim(),
      relay: $("relay").value.trim(),
      seed: $("seed").checked,
      share: $("share").checked,
      communityBlur: $("communityBlur").checked,
      actions: Object.fromEntries(
        CATEGORIES.map((c) => [c, $<HTMLSelectElement>(c).value]),
      ) as Settings["actions"],
    };
    const urls = [];
    if (s.mode !== "community")
      urls.push(endpointURL(s.provider, s.mode === "ollama"));
    if (s.relay) urls.push(endpointURL(s.relay));
    await grant(urls);
    const result = await chrome.runtime.sendMessage({
      type: "save",
      settings: s,
      token: $("token").value,
    });
    $("token").value = "";
    return result;
  });
});
$("mode").addEventListener("change", () => modeChanged(true));
$("oauth").addEventListener(
  "click",
  () =>
    void run(async () => {
      await grant([new URL("https://openrouter.ai")]);
      const result = await chrome.runtime.sendMessage({ type: "oauth" });
      if (!result?.error) {
        $<HTMLSelectElement>("mode").value = "api";
        $("provider").value = defaults.provider;
        modeChanged();
        return { status: "OpenRouter connected. Choose a model and save." };
      }
      return result;
    }),
);
$("disconnect").addEventListener(
  "click",
  () => void run(() => chrome.runtime.sendMessage({ type: "disconnect" })),
);
$("clear").addEventListener(
  "click",
  () => void run(() => chrome.runtime.sendMessage({ type: "clear" })),
);
void chrome.runtime.sendMessage({ type: "settings" }).then((s: Settings) => {
  for (const k of ["consent", "seed", "share", "communityBlur"] as const)
    $(k).checked = s[k];
  for (const k of ["mode", "provider", "model", "interests", "relay"] as const)
    $(k).value = s[k];
  for (const c of CATEGORIES) $<HTMLSelectElement>(c).value = s.actions[c];
  modeChanged();
  void refresh();
});
