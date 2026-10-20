import { CATEGORIES, type Category } from "./protocol.ts";
export interface Settings {
  consent: boolean;
  mode: "api" | "ollama" | "community";
  provider: string;
  model: string;
  interests: string;
  relay: string;
  seed: boolean;
  share: boolean;
  communityBlur: boolean;
  actions: Record<Category, "blur" | "colour" | "ignore">;
}
export const defaults: Settings = {
  consent: false,
  mode: "api",
  provider: "https://openrouter.ai/api/v1/chat/completions",
  model: "",
  interests: "",
  relay: "",
  seed: true,
  share: true,
  communityBlur: false,
  actions: Object.fromEntries(
    CATEGORIES.map((c) => [c, "blur"]),
  ) as Settings["actions"],
};
export type FeedSettings = Pick<
  Settings,
  "consent" | "actions" | "communityBlur" | "share"
>;
export function publicSettings(s: Settings): FeedSettings {
  return {
    consent: s.consent,
    actions: s.actions,
    communityBlur: s.communityBlur,
    share: s.share,
  };
}
