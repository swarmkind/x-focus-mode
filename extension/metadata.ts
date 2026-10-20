export {};
import { publicVisibility } from "./adapter.ts";
let enabled = false;
window.addEventListener("message", (event) => {
  if (
    event.source === window &&
    event.origin === location.origin &&
    event.data?.type === "xfm-metadata-enabled" &&
    typeof event.data.enabled === "boolean"
  )
    enabled = event.data.enabled;
});
// Only explicit public visibility from home timeline responses permits contribution.
// Page-world data is a compatibility hint, not an authentication boundary.
const homeResponse = (url: string) =>
  /^https:\/\/x\.com\/i\/api\/graphql\/[^/]+\/Home(Latest)?Timeline(?:\?|$)/.test(
    url,
  );
function inspect(text: string) {
  if (!enabled || location.pathname !== "/home" || text.length > 2_000_000)
    return;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  const stack: { value: unknown; restricted: boolean }[] = [
    { value: data, restricted: false },
  ];
  let visited = 0;
  const posts: { id: string; author: string; public: boolean }[] = [];
  while (stack.length && ++visited < 20_000 && posts.length < 100) {
    const item = stack.pop()!;
    if (!item.value || typeof item.value !== "object") continue;
    const r = item.value as Record<string, any>;
    const restricted =
      item.restricted || r.__typename === "TweetWithVisibilityResults";
    if (r.__typename === "Tweet" && /^\d{1,20}$/.test(r.rest_id || "")) {
      const u = r.core?.user_results?.result;
      const publicPost = publicVisibility(
        u?.legacy?.protected,
        restricted ||
          !!r.limitedActionResults ||
          !!r.trusted_friends_info ||
          !!r.community_results,
      );
      // Unknown visibility stays local; it must not masquerade as a protected post.
      if (publicPost !== undefined)
        posts.push({
          id: r.rest_id,
          author: u?.legacy?.screen_name || u?.core?.screen_name || "",
          public: publicPost,
        });
    }
    for (const child of Object.values(r))
      if (child && typeof child === "object")
        stack.push({ value: child, restricted });
  }
  if (posts.length)
    window.postMessage(
      { type: "xfm-public-metadata-v1", posts },
      location.origin,
    );
}
async function readResponse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return;
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (enabled) {
      const chunk = await reader.read();
      if (chunk.done) {
        inspect(text + decoder.decode());
        break;
      }
      size += chunk.value.length;
      if (size > 2_000_000) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  const url =
    typeof args[0] === "string"
      ? new URL(args[0], location.href).href
      : args[0] instanceof URL
        ? args[0].href
        : args[0].url;
  if (enabled && homeResponse(url) && homeResponse(response.url))
    void readResponse(response.clone()).catch(() => {});
  return response;
};
const open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  ...rest: any[]
) {
  if (homeResponse(new URL(String(url), location.href).href))
    this.addEventListener(
      "load",
      () => {
        try {
          if (!enabled || !homeResponse(this.responseURL)) return;
          if (this.responseType === "" || this.responseType === "text")
            inspect(this.responseText);
        } catch {
          /* X changed response type. */
        }
      },
      { once: true },
    );
  return (open as any).call(this, method, url, ...rest);
};
