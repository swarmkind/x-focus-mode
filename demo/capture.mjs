import { chromium } from "playwright";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fixtureServer } from "../tests/server.mjs";
import { chromePath } from "../tests/chrome.mjs";
execFileSync(process.execPath, ["scripts/build.mjs", "--test"], {
  stdio: "inherit",
});
execFileSync(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "x-focus-mode",
    "--local",
    "--command",
    "DELETE FROM reports",
  ],
  { stdio: "pipe" },
);
const output = "videos/x-focus-mode/capture/assets";
await mkdir(output, { recursive: true });
await mkdir("artifacts/capture-raw", { recursive: true });
const fixture = await fixtureServer(),
  contexts = [],
  cuts = {};
async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}
async function instance(mode, share) {
  const context = await chromium.launchPersistentContext(
    await mkdtemp(join(tmpdir(), "xfm-demo-")),
    {
      executablePath: chromePath(),
      headless: true,
      viewport: { width: 1100, height: 820 },
      recordVideo: {
        dir: "artifacts/capture-raw",
        size: { width: 1100, height: 820 },
      },
      args: [
        `--disable-extensions-except=${resolve("artifacts/test-extension")}`,
        `--load-extension=${resolve("artifacts/test-extension")}`,
      ],
    },
  );
  contexts.push(context);
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = worker.url().split("/")[2];
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  await options.evaluate(
    async ({ mode, share }) => {
      const s = await chrome.runtime.sendMessage({ type: "settings" });
      await chrome.runtime.sendMessage({
        type: "save",
        settings: {
          ...s,
          consent: true,
          mode,
          provider: "http://127.0.0.1:4173/api/chat",
          model: "fixture-only",
          interests: "Practical engineering and gardening",
          relay: "http://127.0.0.1:4173",
          seed: true,
          share,
        },
        token: "",
      });
    },
    { mode, share },
  );
  return { context, worker, options, id };
}
async function save(page, name, created, start, duration) {
  await page.close();
  const raw = await page.video().path();
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      String(start - created),
      "-i",
      raw,
      "-t",
      String(duration),
      "-an",
      "-c:v",
      "libvpx-vp9",
      "-crf",
      "28",
      "-b:v",
      "0",
      `${output}/${name}.webm`,
    ],
    { stdio: "pipe" },
  );
  cuts[name] = {
    duration,
    source: "actual isolated Chrome extension recording",
    model: "scripted local test fixture",
  };
}
try {
  const a = await instance("ollama", true);
  let created = Date.now() / 1000;
  const feed = await a.context.newPage();
  await feed.goto("http://127.0.0.1:4173/home");
  const first = feed.locator("article").first();
  await first
    .locator(".label")
    .filter({ hasText: "Engagement farming" })
    .waitFor();
  await feed
    .locator("article")
    .nth(1)
    .getByText("Matches your interests", { exact: true })
    .waitFor();
  await wait(600);
  let start = Date.now() / 1000;
  await feed.screenshot({ path: `${output}/feed.png` });
  await wait(3000);
  await first.getByRole("button", { name: "Reveal", exact: true }).click();
  await feed.screenshot({ path: `${output}/revealed.png` });
  await wait(3000);
  await first.locator("summary").click();
  await wait(2500);
  await first.getByRole("button", { name: "Accurate", exact: true }).click();
  await first
    .getByText("Signed human report published", { exact: true })
    .waitFor();
  await wait(8000);
  await save(feed, "feed", created, start, 16);
  const b = await instance("community", false);
  created = Date.now() / 1000;
  const second = await b.context.newPage();
  await second.goto("http://127.0.0.1:4173/home");
  await second
    .locator("article")
    .first()
    .getByText(/Community: 1 human report/)
    .waitFor();
  await wait(600);
  start = Date.now() / 1000;
  await second.screenshot({ path: `${output}/community.png` });
  await wait(8500);
  await save(second, "peer", created, start, 8);
  created = Date.now() / 1000;
  const options = await a.context.newPage();
  await options.goto(`chrome-extension://${a.id}/options.html`);
  await options.locator("#mode").selectOption("api");
  await options.locator("#model").fill("Your chosen provider model");
  await wait(600);
  start = Date.now() / 1000;
  await options.screenshot({ path: `${output}/options-api.png` });
  await wait(5000);
  await options.locator("#mode").selectOption("ollama");
  await options.locator("#model").fill("Your installed local model");
  await options.screenshot({ path: `${output}/options-local.png` });
  await wait(7500);
  await save(options, "settings", created, start, 12);
  const privacy = await a.context.newPage();
  await privacy.goto(`chrome-extension://${a.id}/options.html`);
  await privacy.locator("#relay").scrollIntoViewIfNeeded();
  await privacy.screenshot({ path: `${output}/network.png` });
  await privacy.close();
  await writeFile(
    "videos/x-focus-mode/capture/cuts.json",
    JSON.stringify(cuts, null, 2),
  );
  console.log(
    "Captured actual extension controls: feed 16s, second installation 8s, settings 12s",
  );
} finally {
  for (const c of contexts) await c.close();
  fixture.server.close();
}
