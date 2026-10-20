import { chromePath } from "./chrome.mjs";
import { chromium } from "playwright";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fixtureServer } from "./server.mjs";
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
await mkdir("artifacts", { recursive: true });
const fixture = await fixtureServer(),
  contexts = [],
  results = [];
const executablePath = chromePath();
async function instance() {
  const profile = await mkdtemp(join(tmpdir(), "xfm-browser-"));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    args: [
      `--disable-extensions-except=${resolve("artifacts/test-extension")}`,
      `--load-extension=${resolve("artifacts/test-extension")}`,
    ],
  });
  contexts.push(context);
  await context.addInitScript(() => {
    window.__xfmLongTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__xfmLongTasks.push(e.duration);
    }).observe({ type: "longtask", buffered: true });
  });
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = worker.url().split("/")[2];
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  return { context, worker, id, options };
}
async function configure(i, changes = {}) {
  return i.options.evaluate(async (changes) => {
    const s = await chrome.runtime.sendMessage({ type: "settings" });
    return chrome.runtime.sendMessage({
      type: "save",
      settings: {
        ...s,
        consent: true,
        mode: "ollama",
        provider: "http://127.0.0.1:4173/api/chat",
        model: "fixture-only",
        relay: "http://127.0.0.1:4173",
        ...changes,
      },
      token: "",
    });
  }, changes);
}
const status = (card, text) => card.locator(`.trigger[title*="${text}"]`);
const reject = (card) => card.getByRole("button", { name: "Reject post", exact: true });
async function choose(card, reason) {
  await reject(card).click();
  await card.getByRole("menuitem", { name: reason, exact: true }).click();
}
async function check(name, fn) {
  const at = performance.now();
  await fn();
  results.push({ name, passed: true, ms: Math.round(performance.now() - at) });
  console.log("PASS", name);
}
try {
  const a = await instance();
  await check("onboarding defaults remain inactive until consent", async () => {
    assert.equal(await a.options.locator("#consent").isChecked(), false);
    assert.equal(await a.options.locator("#seed").isChecked(), true);
    assert.equal(await a.options.locator("#share").isChecked(), true);
    assert.equal(fixture.calls.length, 0);
  });
  const feed = await a.context.newPage();
  await feed.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = 'article { display:flex; flex-direction:row } article > div { flex:1; min-width:0 }';
      document.head.append(style);
    });
  });
  await feed.goto("http://127.0.0.1:4173/home");
  const baseline = await feed.locator("article").evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
  assert.equal((await configure(a)).status, "Settings saved");
  await feed.reload();
  const first = feed.locator("article").nth(0),
    second = feed.locator("article").nth(1);
  await check(
    "real content script blurs, highlights, excludes own/protected posts",
    async () => {
      await first
        .getByRole("button", { name: "Reveal", exact: true })
        .waitFor();
      await status(first, "Engagement farming").waitFor();
      await status(second, "Matches your interests").waitFor();
      assert.ok(fixture.modelCalls.length > 0);
      assert.ok(fixture.modelCalls.every((call) => call.think === false));
      assert.equal(
        await feed
          .locator('article[data-id="1000000000000000006"] [data-xfm]')
          .count(),
        0,
      );
      assert.equal(
        await feed
          .locator('article[data-id="1000000000000000007"] [data-xfm]')
          .count(),
        0,
      );
    },
  );
  await check(
    "keyboard Reveal preserves focus and exposes labelled controls",
    async () => {
      const card = feed.locator("article").nth(2);
      await card.getByRole("button", { name: "Reveal", exact: true }).focus();
      await feed.keyboard.press("Enter");
      assert.equal(
        await reject(card)
          .evaluate((b) => b.getRootNode().activeElement === b),
        true,
      );
      await feed.keyboard.press("Enter");
      await feed.keyboard.press("End");
      await feed.keyboard.press("Enter");
      await card.getByRole("button", { name: "Reveal", exact: true }).waitFor();
      assert.equal(
        await card.getByRole("group", { name: "X Focus Mode" }).count(),
        1,
      );
      await feed.evaluate(() => scrollTo(0, 0));
    },
  );
  await check("compact controls and open menus add zero post height", async () => {
    const heights = () => feed.locator("article").evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    assert.deepEqual(await heights(), baseline);
    await reject(first).click();
    assert.deepEqual(await heights(), baseline);
    await feed.keyboard.press("ArrowDown");
    assert.equal(await first.getByRole("menuitem", { name: "Doomering", exact: true }).evaluate(b => b.getRootNode().activeElement === b), true);
    await feed.keyboard.press("Escape");
    assert.equal(await reject(first).getAttribute("aria-expanded"), "false");
    assert.equal(await reject(first).evaluate(b => b.getRootNode().activeElement === b), true);
    assert.deepEqual(await heights(), baseline);
  });
  await check("Reveal is instant and is not a human confirmation", async () => {
    const before = fixture.calls.filter(
      (x) => x.path === "/v1/report" && JSON.parse(x.body).source === "human",
    ).length;
    const ms = await first.evaluate((article) => {
      const start = performance.now();
      const root = article.querySelector("[data-xfm-overlay]").shadowRoot;
      [...root.querySelectorAll("button")]
        .find((b) => b.textContent === "Reveal")
        .click();
      if (article.querySelector('[data-testid="tweetText"]').closest("[inert]"))
        throw new Error("Still inaccessible");
      return performance.now() - start;
    });
    assert.ok(ms < 50, `Reveal took ${ms}ms`);
    assert.equal(
      fixture.calls.filter(
        (x) => x.path === "/v1/report" && JSON.parse(x.body).source === "human",
      ).length,
      before,
    );
    results.push({ name: "Reveal latency", ms });
  });
  await check(
    "same DOM card recycling preserves reveal and refreshes a changed tweet ID",
    async () => {
      await first.evaluate((article) => {
        article.innerHTML = window.renderPost(window.fixturePosts[0]).innerHTML;
      });
      await status(first, "Engagement farming").waitFor();
      assert.equal(await first.getByRole("button", { name: "Reveal", exact: true }).count(), 0);
      await first.evaluate((article) => {
        article.innerHTML = window.renderPost(window.fixturePosts[2]).innerHTML;
      });
      await status(first, "Doomering").waitFor();
      await first
        .getByRole("button", { name: "Reveal", exact: true })
        .waitFor();
      await first.evaluate((article) => {
        article.innerHTML = window.renderPost(window.fixturePosts[0]).innerHTML;
      });
      await status(first, "Engagement farming").waitFor();
      assert.equal(await first.getByRole("button", { name: "Reveal", exact: true }).count(), 0);
    },
  );
  await check("30 repeated feed-card replacements keep one overlay per card", async () => {
    for (let i = 0; i < 30; i++) {
      await first.evaluate((article, index) => {
        article.innerHTML = window.renderPost(window.fixturePosts[index]).innerHTML;
      }, i % 2 ? 0 : 2);
      await status(first, i % 2 ? "Engagement farming" : "Doomering").waitFor();
      assert.equal(await first.locator("[data-xfm]").count(), 1);
    }
  });
  await check(
    "explicit feedback creates signed minimal human report",
    async () => {
      await choose(first, "Engagement farming");
      await reject(first).click();
      await first
        .getByText("Signed human report published", { exact: true })
        .waitFor();
      const body = JSON.parse(
        fixture.calls.filter((x) => x.path === "/v1/report").at(-1).body,
      );
      assert.equal(body.source, "human");
      assert.equal(body.tweetId, "1000000000000000001");
      assert.deepEqual(
        Object.keys(body).sort(),
        [
          "v",
          "tweetId",
          "categories",
          "source",
          "model",
          "publisher",
          "revision",
          "issuedAt",
          "expiresAt",
          "withdrawn",
          "signature",
        ].sort(),
      );
    },
  );
  await check(
    "redraw preserves Reveal and community badge persists on detail",
    async () => {
      await first.getByRole("button", { name: "Reveal", exact: true }).click();
      await feed.evaluate(() => window.loadFixture());
      await status(first, "Engagement farming").waitFor();
      assert.equal(await first.getByRole("button", { name: "Reveal", exact: true }).count(), 0);
      assert.equal(
        await first
          .getByRole("button", { name: "Reveal", exact: true })
          .count(),
        0,
      );
      await feed.goto(
        "http://127.0.0.1:4173/CircuitNotes/status/1000000000000000001",
      );
      await status(first, "Community: 1 human report").waitFor();
      await first.locator(".badge").waitFor();
    },
  );
  const b = await instance();
  assert.equal(
    (await configure(b, { mode: "community", share: false })).status,
    "Settings saved",
  );
  const peerFeed = await b.context.newPage();
  await peerFeed.goto("http://127.0.0.1:4173/home");
  await check(
    "second installation receives warning with no model calls",
    async () => {
      await status(peerFeed.locator("article").first(), "Community: 1 human report").waitFor();
      assert.equal(
        await peerFeed
          .locator("article")
          .first()
          .getByRole("button", { name: "Reveal", exact: true })
          .count(),
        0,
      );
      const card = peerFeed.locator("article").first();
      await choose(card, "Hide this post");
      await card.getByRole("button", { name: "Reveal", exact: true }).waitFor();
      await card.getByRole("button", { name: "Reveal", exact: true }).click();
      await status(card, "Community: 1 human report").waitFor();
      await card.locator(".badge").waitFor();
    },
  );
  await check(
    "offscreen peers establish native WebRTC and transfer reports",
    async () => {
      await b.options.waitForFunction(
        async () => {
          const r = await chrome.runtime.sendMessage({ type: "status" });
          return r.network?.peers > 0;
        },
        null,
        { timeout: 20000 },
      );
      await b.options.evaluate(() =>
        chrome.runtime.sendMessage({ type: "clear" }),
      );
      const network = await b.worker.evaluate(() =>
        chrome.runtime.sendMessage({
          target: "offscreen",
          type: "lookup",
          ids: ["1000000000000000001"],
        }),
      );
      assert.ok(network.reports.some((r) => r.source === "human"));
      const s = await b.options.evaluate(() =>
        chrome.runtime.sendMessage({ type: "status" }),
      );
      assert.ok(
        s.network.transfers > 0,
        JSON.stringify({ network: s.network, reply: network }),
      );
    },
  );
  await check(
    "persistent peer byte budget refuses over-limit transfer",
    async () => {
      const allowed = await b.options.evaluate(async () => {
        const m = await import("./store.js");
        await m.saveMetadata("budget:upload", {
          day: Math.floor(Date.now() / 86400000),
          used: 9999990,
        });
        return m.reserveBudget("upload", 20);
      });
      assert.equal(allowed, false);
    },
  );
  await check(
    "network off switch closes offscreen document immediately",
    async () => {
      assert.equal(
        (await configure(b, { mode: "community", seed: false, share: false }))
          .status,
        "Settings saved",
      );
      assert.equal(
        await b.worker.evaluate(
          async () =>
            (
              await chrome.runtime.getContexts({
                contextTypes: ["OFFSCREEN_DOCUMENT"],
              })
            ).length,
        ),
        0,
      );
    },
  );
  await check("private content and preferences never reach relay", async () => {
    for (const call of fixture.calls) {
      assert.ok(
        !/My own post|protected post|soil moisture|interests|Authorization|fixture-only.*api\/chat/.test(
          call.body,
        ),
      );
      if (call.path === "/v1/report") {
        const r = JSON.parse(call.body);
        assert.notEqual(r.tweetId, "1000000000000000006");
        assert.notEqual(r.tweetId, "1000000000000000007");
      }
    }
  });
  await a.options.screenshot({
    path: "artifacts/settings.png",
    fullPage: true,
  });
  await feed.goto("http://127.0.0.1:4173/home");
  await status(first, "Engagement farming").waitFor();
  await status(second, "Matches your interests").waitFor();
  await feed.screenshot({ path: "artifacts/feed.png" });
  await feed.setViewportSize({ width: 1280, height: 800 });
  await feed.screenshot({ path: "artifacts/store-feed.png" });
  await a.options.setViewportSize({ width: 1280, height: 800 });
  await a.options.screenshot({ path: "artifacts/store-settings.png" });
  await check("settings fit a 360px window and expose maker/support links", async () => {
    await a.options.setViewportSize({ width: 360, height: 800 });
    assert.equal(await a.options.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await a.options.locator(".coffee").getAttribute("href"),
      "https://buymeacoffee.com/swarmkind");
    assert.ok(await a.options.getByText("@swarmkind", { exact: true }).count());
    await a.options.screenshot({ path: "artifacts/settings-mobile.png", fullPage: true });
    await a.options.setViewportSize({ width: 1280, height: 800 });
  });
  await check("Reveal restores existing native styles and inert state", async () => {
    const page = await a.context.newPage();
    await page.goto("http://127.0.0.1:4173/home?native=1");
    const card = page.locator("article").first();
    await status(card, "Engagement farming").waitFor();
    await card.getByRole("button", { name: "Reveal", exact: true }).click();
    assert.deepEqual(await card.evaluate((article) => {
      const child = article.querySelector('[data-testid="tweetText"]');
      return {
        filter: child.style.filter,
        filterPriority: child.style.getPropertyPriority("filter"),
        pointer: child.style.pointerEvents,
        pointerPriority: child.style.getPropertyPriority("pointer-events"),
        inert: child.getAttribute("inert"),
      };
    }), { filter: "grayscale(0.5)", filterPriority: "important", pointer: "auto", pointerPriority: "important", inert: "native" });
    await page.close();
  });
  await check("Feedback stays in the feed and corrections update immediately across redraws", async () => {
    const card = feed.locator("article").nth(2);
    await card.evaluate((article) => {
      window.__nativeCardClicks = 0;
      article.addEventListener("click", () => window.__nativeCardClicks++);
    });
    await choose(card, "Incorrect · show this post");
    await status(card, "Your correction · shown").waitFor();
    assert.equal(await feed.evaluate(() => window.__nativeCardClicks), 0);
    assert.equal(await card.locator('[inert]').count(), 0);
    await card.evaluate((article) => {
      article.innerHTML = window.renderPost(window.fixturePosts[2]).innerHTML;
    });
    await status(card, "Your correction · shown").waitFor();
  });
  await check("reject an unflagged post, persist on refresh, undo locally", async () => {
    await configure(a, { share: false, seed: false });
    await feed.reload();
    const card = feed.locator("article").nth(3);
    await status(card, "Reviewed").waitFor();
    const height = await card.evaluate(e => e.getBoundingClientRect().height);
    await choose(card, "Ragebait");
    await card.getByRole("button", { name: "Reveal", exact: true }).waitFor();
    await a.options.waitForFunction(async () => (await chrome.storage.local.get("rejections")).rejections?.["1000000000000000004"] === "ragebait");
    assert.equal(await card.evaluate(e => e.getBoundingClientRect().height), height);
    await feed.reload();
    await status(card, "Rejected · Ragebait").waitFor();
    await card.getByRole("button", { name: "Reveal", exact: true }).waitFor();
    await choose(card, "Incorrect · show this post");
    await status(card, "Your correction").waitFor();
    await a.options.waitForFunction(async () => !(await chrome.storage.local.get("rejections")).rejections?.["1000000000000000004"]);
    assert.equal(await card.getByRole("button", { name: "Reveal", exact: true }).count(), 0);
  });
  await check("rejection works after Chrome stops and restarts the background worker", async () => {
    const card = feed.locator("article").nth(3);
    const session = await a.context.newCDPSession(a.options);
    const lifecycle = [];
    let markRunning;
    const restarted = new Promise(resolve => { markRunning = resolve; });
    const stopped = new Promise(resolve => session.on("ServiceWorker.workerVersionUpdated", ({ versions }) => {
      for (const version of versions) if (version.scriptURL === a.worker.url()) {
        lifecycle.push(version.runningStatus);
        if (version.runningStatus === "stopped") resolve();
        if (version.runningStatus === "running" && lifecycle.includes("stopped")) markRunning();
      }
    }));
    await session.send("ServiceWorker.enable");
    await session.send("ServiceWorker.stopAllWorkers");
    await stopped;
    await choose(card, "Doomering");
    await a.options.waitForFunction(async () => (await chrome.storage.local.get("rejections")).rejections?.["1000000000000000004"] === "doomering");
    await restarted;
    assert.ok(lifecycle.lastIndexOf("running") > lifecycle.indexOf("stopped"), lifecycle.join(","));
    await status(card, "Rejected · Doomering").waitFor();
    await card.getByRole("button", { name: "Reveal", exact: true }).waitFor();
    await choose(card, "Incorrect · show this post");
    await a.options.waitForFunction(async () => !(await chrome.storage.local.get("rejections")).rejections?.["1000000000000000004"]);
    await session.detach();
  });
  await check("narrow-screen menu stays inside viewport and dismisses on scroll/outside click", async () => {
    await feed.setViewportSize({ width: 380, height: 800 });
    await first.scrollIntoViewIfNeeded();
    const height = await first.evaluate(e => e.getBoundingClientRect().height);
    await reject(first).click();
    const menu = first.getByRole("menu");
    assert.equal(await menu.evaluate(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }), true);
    assert.equal(await first.evaluate(e => e.getBoundingClientRect().height), height);
    await feed.screenshot({ path: "artifacts/compact-menu-mobile.png" });
    await feed.mouse.click(5, 5);
    await menu.waitFor({ state: "hidden" });
    await reject(first).click();
    await feed.mouse.wheel(0, 100);
    await menu.waitFor({ state: "hidden" });
    await feed.setViewportSize({ width: 1280, height: 800 });
    await first.scrollIntoViewIfNeeded();
    await reject(first).click();
    await feed.screenshot({ path: "artifacts/compact-menu.png" });
    await feed.keyboard.press("Escape");
  });
  await check(
    "slow model fails open after one second, late result does not hide read card",
    async () => {
      fixture.setDelay(1600);
      await a.worker.evaluate(async () => { await chrome.storage.session.clear(); await chrome.storage.local.remove(["rejections", "corrections"]); });
      await configure(a, { share: false, seed: false });
      const slow = await a.context.newPage();
      await slow.goto("http://127.0.0.1:4173/home");
      const card = slow.locator("article").first();
      await status(card, "Unreviewed").waitFor();
      assert.equal(
        await card.getByRole("button", { name: "Reveal", exact: true }).count(),
        0,
      );
      await status(card, "Engagement farming").waitFor();
      assert.equal(
        await card.getByRole("button", { name: "Reveal", exact: true }).count(),
        0,
      );
    },
  );
  await check("explicit rejection survives a late conflicting model result", async () => {
    await a.worker.evaluate(() => chrome.storage.session.clear());
    const page = await a.context.newPage();
    await page.goto("http://127.0.0.1:4173/home");
    const card = page.locator("article").nth(1);
    await status(card, "Checking").waitFor();
    await choose(card, "Ragebait");
    await status(card, "Rejected · Ragebait").waitFor();
    // Wait beyond the scripted 1.6-second response to exercise the late-result race.
    await page.waitForTimeout(1900);
    await status(card, "Rejected · Ragebait").waitFor();
    await card.getByRole("button", { name: "Reveal", exact: true }).waitFor();
    await page.close();
  });
  await check(
    "API mode sends keys only to its selected provider and excludes unknown visibility",
    async () => {
      const calls = [];
      await a.context.route("https://model.fixture/chat", async (route) => {
        const req = route.request(),
          body = req.postDataJSON();
        calls.push({ body, headers: req.headers() });
        const input = JSON.parse(body.messages[1].content);
        await route.fulfill({
          json: {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    results: input.posts.map((p) => ({
                      id: p.id,
                      categories: [],
                      confidence: "clear",
                      relevant: false,
                      needsContext: false,
                    })),
                  }),
                },
              },
            ],
          },
        });
      });
      const result = await a.options.evaluate(async () => {
        const s = await chrome.runtime.sendMessage({ type: "settings" });
        return chrome.runtime.sendMessage({
          type: "save",
          settings: {
            ...s,
            mode: "api",
            provider: "https://model.fixture/chat",
            model: "fixture-api",
            relay: "",
            seed: false,
            share: false,
          },
          token: "fixture-token-not-secret",
        });
      });
      assert.equal(result.status, "Settings saved");
      const apiPage = await a.context.newPage();
      await apiPage.goto("http://127.0.0.1:4173/home");
      await status(apiPage.locator("article").first(), "Reviewed · no filter applied").waitFor();
      assert.ok(calls.length > 0);
      assert.ok(
        calls.every(
          (c) => c.headers.authorization === "Bearer fixture-token-not-secret",
        ),
      );
      const ids = calls.flatMap((c) =>
        JSON.parse(c.body.messages[1].content).posts.map((p) => p.id),
      );
      assert.ok(!ids.includes("1000000000000000006"));
      assert.ok(!ids.includes("1000000000000000007"));
      const count = calls.length;
      await apiPage.evaluate(() => {
        const p = {
          id: "1000000000000000099",
          author: "UnknownUser",
          name: "Unknown visibility",
          text: "Private visibility has not been established.",
        };
        document.getElementById("posts").prepend(window.renderPost(p));
      });
      await status(apiPage.locator("article").first(), "Unreviewed · public visibility unconfirmed").waitFor();
      assert.equal(calls.length, count);
    },
  );
  await check(
    "excluded routes stay untouched and SPA navigation activates the home adapter",
    async () => {
      const page = await a.context.newPage();
      await page.goto("http://127.0.0.1:4173/demo_viewer");
      assert.equal(await page.locator("[data-xfm]").count(), 0);
      await page.evaluate(() => {
        history.pushState({}, "", "/home");
        window.loadFixture();
      });
      await page
        .locator("article")
        .first()
        .getByRole("group", { name: "X Focus Mode" })
        .waitFor();
      await page.evaluate(() => {
        history.pushState({}, "", "/messages");
        window.loadFixture();
      });
      await page.locator("[data-xfm]").first().waitFor({ state: "detached" });
    },
  );
  const longTasks = await feed.evaluate(() => window.__xfmLongTasks || []);
  results.push({
    name: "Observed fixture main-thread tasks over 50 ms",
    count: longTasks.length,
    maxMs: longTasks.length ? Math.max(...longTasks) : 0,
    attribution: "Whole page; not an extension-only profiler",
  });
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: await a.context.browser()?.version(),
        results,
      },
      null,
      2,
    ),
  );
} finally {
  for (const c of contexts) await c.close();
  fixture.server.close();
}
