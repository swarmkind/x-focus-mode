import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { chromePath } from "../tests/chrome.mjs";

// Original vector artwork. The export browser is isolated from personal profiles.
const out = "assets/launch";
await mkdir(out, { recursive: true });
const colors = { ink: "#101b20", panel: "#17282d", line: "#36504f", mint: "#b4dbc4", text: "#e4eee9", muted: "#a8bcb8" };
const escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const text = (x, y, content, size = 26, color = colors.text, weight = 400) =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}">${escape(content)}</text>`;
const lines = (x, y, content, size = 26, color = colors.muted) =>
  content.map((s, i) => text(x, y + i * (size * 1.45), s, size, color)).join("");
const mark = (x, y, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M25 15H15V25M39 15H49V25M49 39V49H39M25 49H15V39" fill="none" stroke="${colors.mint}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="32" r="6" fill="${colors.mint}"/></g>`;
const shell = (title, subtitle, body, n) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-labelledby="title desc">
<title id="title">${escape(title.join(" "))}</title><desc id="desc">${escape(subtitle.join(" "))}</desc>
<rect width="1080" height="1350" fill="${colors.ink}"/>
<g font-family="Arial, Helvetica, sans-serif">
${mark(58, 46, 1.1)}${text(145, 91, "X FOCUS MODE", 24, colors.mint, 700)}
${text(826, 91, `GUIDE 0${n} / 03`, 17, colors.muted)}
${lines(72, 202, title, 66, colors.text)}
${lines(76, 340, subtitle, 25)}
${body}
<path d="M76 1210H1004" stroke="${colors.line}"/>
${text(76, 1256, "@swarmkind", 25, colors.mint, 700)}
${text(1004, 1256, "OPEN SOURCE · DEVELOPER PREVIEW", 17, colors.muted).replace('y="1256"', 'y="1256" text-anchor="end"')}
${text(76, 1294, "github.com/swarmkind/x-focus-mode", 20, colors.muted)}
</g></svg>`;
function card(y, number, title, body, height = 158) {
  return `<rect x="76" y="${y}" width="928" height="${height}" rx="20" fill="${colors.panel}" stroke="${colors.line}"/>
  <circle cx="125" cy="${y + 47}" r="22" fill="none" stroke="${colors.mint}"/>
  ${text(125, y + 54, number, 18, colors.mint, 700).replace(`y="${y + 54}"`, `y="${y + 54}" text-anchor="middle"`)}
  ${text(166, y + 55, title, 30, colors.text, 700)}
  ${lines(166, y + 96, body, 24)}`;
}
const posters = [
  ["01-get-started", shell(["Make room for", "a quieter feed."], ["Install the preview. Choose your reviewer.", "Decide what deserves your attention."],
    card(428, "1", "Load the extension", ["Download and extract the release ZIP.", "Chrome extensions → Developer mode → Load unpacked."]) +
    card(604, "2", "Choose a reviewer", ["Connect OpenRouter / an API key, use existing Ollama,", "or choose community-only with a compatible relay."]) +
    card(780, "3", "Set your filters", ["Blur, colour or ignore each category.", "Add interests for personal highlights."]) +
    card(956, "4", "Review, save, reload X", ["Read the disclosure. Choose sharing and distribution.", "Accept, save, then reload your X home feed."]) +
    text(76, 1160, "API credits cost money. No public Swarmkind relay is live yet.", 22), 1)],
  ["02-you-stay-in-control", shell(["A label is a suggestion.", "You stay in control."], ["Ragebait · Doomering · Engagement farming", "Suspected AI slop — never proof of authorship."],
    card(428, "1", "Reveal immediately", ["Click Reveal to show the post. No model call is needed.", "Opening a post never counts as agreeing with a flag."]) +
    card(604, "2", "Inspect the source", ["Your AI and community reports have separate labels.", "Community warnings stay visible after you reveal."]) +
    card(780, "3", "Give explicit feedback", ["Use Accurate only when you agree with the category.", "Sharing applies only to eligible public feed posts."]) +
    card(956, "4", "Make it your feed", ["Choose Colour for a gentler cue, or Ignore a category.", "Community auto-blur starts off. You can enable it."]) +
    text(76, 1160, "Models and people make mistakes. Missing context stays unreviewed.", 22), 2)],
  ["03-where-data-goes", shell(["Know what leaves", "your computer."], ["Three ways to review posts.", "Sharing and distribution have separate switches."],
    card(428, "A", "Your API provider", ["Receives eligible public post text and your interests.", "Your key is sent only to the configured provider."]) +
    card(604, "B", "Local Ollama", ["Receives text and interests on this computer.", "Requires an installed model and a running local service."]) +
    card(780, "C", "Community network", ["Reports: tweet ID, categories, human/model source,", "model name, signing key, signature, revision and expiry."], 180) +
    lines(88, 1014, ["No tweet text, handles, API keys or reveal history in reports.",
      "Signing keys link contributions. Peers can see your public IP.",
      "Signed does not mean true. Shared copies can remain.",
      "Nothing activates before disclosure, acceptance and Save."], 24, colors.text), 3)]
];
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="X Focus Mode, your attention, your rules">
<rect width="1200" height="630" fill="${colors.ink}"/>
<g font-family="Arial, Helvetica, sans-serif">
${mark(68, 61, 1.25)}${text(178, 114, "@SWARMKIND / OPEN SOURCE", 21, colors.mint, 700)}
${text(80, 270, "X Focus Mode", 88, colors.text, 700)}
${text(84, 338, "Your attention, your rules.", 38)}
${text(84, 414, "Personal filters for X. Instant Reveal. Optional community warnings.", 25, colors.muted)}
<path d="M84 488H1116" stroke="${colors.line}"/>
${text(84, 542, "github.com/swarmkind/x-focus-mode", 24, colors.mint)}
${text(1116, 542, "DEVELOPER PREVIEW", 17, colors.muted).replace('y="542"', 'y="542" text-anchor="end"')}
</g></svg>`;
posters.push(["social-cover", cover]);
const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
try {
  const page = await browser.newPage();
  for (const [name, svg] of posters) {
    await writeFile(`${out}/${name}.svg`, svg);
    const width = name === "social-cover" ? 1200 : 1080;
    const height = name === "social-cover" ? 630 : 1350;
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>body{margin:0}svg{display:block}</style>${svg}`);
    const overflow = await page.locator("text").evaluateAll((nodes) =>
      nodes.filter((n) => {
        const b = n.getBoundingClientRect();
        return b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight;
      }).map((n) => n.textContent));
    assert.deepEqual(overflow, [], `${name} has overflowing text`);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
  await page.setViewportSize({ width: 512, height: 512 });
  const logo = (await readFile("assets/brand/mark.svg", "utf8")).replace('width="128" height="128"', 'width="512" height="512"');
  await page.setContent(`<style>body{margin:0;background:transparent}</style>${logo}`);
  await page.screenshot({ path: "assets/brand/mark-512.png", omitBackground: true });
} finally {
  await browser.close();
}
console.log("Exported 3 guides, social cover and 512px logo; no text overflow.");
