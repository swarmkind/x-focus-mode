import { tweetId } from "../shared/protocol.ts";
import type { Post } from "../shared/model.ts";
export interface FeedPost extends Post {
  eligible: boolean;
}
export type Metadata = { author: string; public: boolean };
export function route(path: string): "feed" | "detail" | "excluded" {
  if (path === "/home") return "feed";
  if (/^\/[A-Za-z0-9_]{1,15}\/status\/\d+$/.test(path)) return "detail";
  return "excluded";
}
export function extract(
  article: HTMLElement,
  metadata: Map<string, Metadata>,
  viewer: string,
  path = location.pathname,
): FeedPost | null {
  if (route(path) === "excluded") return null;
  const timeLink = article.querySelector("time")?.closest("a");
  const match = timeLink
    ?.getAttribute("href")
    ?.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
  if (!match || !tweetId(match[2])) return null;
  const author = match[1].toLowerCase(),
    id = match[2];
  if (viewer && author === viewer.toLowerCase()) return null;
  if (
    article.querySelector(
      '[data-testid="icon-lock"], [aria-label="Protected account"]',
    )
  )
    return null;
  const known = metadata.get(id);
  if (known && !known.public) return null;
  const text = [
    ...article.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'),
  ]
    .map((el) => el.innerText)
    .join("\nQuoted post: ")
    .slice(0, 6000);
  const contextIncomplete =
    !!article.querySelector(
      '[data-testid="tweetPhoto"],video,[data-testid="card.wrapper"],[data-testid="tweet-text-show-more-link"]',
    ) || !text;
  return {
    id,
    text,
    contextIncomplete,
    eligible:
      route(path) === "feed" &&
      !!viewer &&
      known?.public === true &&
      known.author.toLowerCase() === author,
  };
}
