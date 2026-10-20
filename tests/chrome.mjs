import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (existsSync(chromium.executablePath())) return chromium.executablePath();
  if (process.platform === "darwin") {
    const cache = join(homedir(), "Library/Caches/ms-playwright");
    if (existsSync(cache))
      for (const folder of readdirSync(cache)
        .filter((n) => /^chromium-\d+$/.test(n))
        .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))) {
        const path = join(
          cache,
          folder,
          "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        );
        if (existsSync(path)) return path;
      }
  }
  throw new Error(
    "Install Chrome for testing: npx playwright install chromium, or set CHROME_PATH",
  );
}
