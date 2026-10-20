import { mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
const root = "videos/x-focus-mode";
await mkdir(`${root}/compositions/frames`, { recursive: true });
await mkdir(`${root}/assets`, { recursive: true });
for (const file of [
  "feed.webm",
  "peer.webm",
  "settings.webm",
  "feed.png",
  "revealed.png",
  "community.png",
  "options-api.png",
  "options-local.png",
  "network.png",
])
  await cp(`${root}/capture/assets/${file}`, `${root}/assets/${file}`);
await cp(
  `${root}/node_modules/gsap/dist/gsap.min.js`,
  `${root}/assets/gsap.min.js`,
);
await rm(`${root}/compositions/components/caption-weight-shift.html`, {
  force: true,
});
const frames = [
  {
    id: "01-intro",
    duration: 5,
    title: "Your attention,<span>your rules.</span>",
    intro: true,
    body: "A quieter feed. Still your choice.",
    captions: [[0, 5, "X Focus Mode · Open-source Chrome preview"]],
  },
  {
    id: "02-reveal",
    duration: 16,
    title: "A filter you control.",
    body: "Blur the bait.<span>Keep what interests you.</span><span>Reveal anything.</span>",
    media: "feed.webm",
    captions: [
      [0, 3, "Let obvious bait wait."],
      [3, 3, "Reveal instantly. No vote is inferred."],
      [6, 3, "Confirm a warning explicitly."],
      [9, 7, "Your confirmation becomes a signed human report."],
    ],
  },
  {
    id: "03-community",
    duration: 8,
    title: "One report.<span>Another reader warned.</span>",
    body: "A second installation receives the community warning.",
    media: "peer.webm",
    captions: [
      [0, 3, "The warning remains visible alongside the post."],
      [3, 5, "Reports are claims. Community auto-blur starts off."],
    ],
  },
  {
    id: "04-reviewer",
    duration: 12,
    title: "Choose your reviewer.",
    body: "Your provider account.<span>An existing local model.</span><span>Or community flags only.</span>",
    media: "settings.webm",
    captions: [
      [0, 5, "Your provider account. Your credits."],
      [5, 7, "Local Ollama is optional. No model weights in the extension."],
    ],
  },
  {
    id: "05-network",
    duration: 11,
    title: "Two independent choices.",
    body: "Share eligible flags.<span>Help distribute reports.</span><span>Activate after informed consent.</span>",
    media: "network.png",
    captions: [
      [0, 4, "Sharing flags and distributing reports have separate controls."],
      [4, 4, "Distribution can continue with X closed, while Chrome runs."],
      [8, 3, "Public reports are not anonymous. Peers may see your IP."],
    ],
  },
  {
    id: "06-source",
    duration: 8,
    title: "Make it yours.",
    intro: true,
    body: "MIT licensed. Inspect it. Change it. Self-host it.",
    source: true,
    captions: [
      [0, 4, "Your attention deserves a considered choice."],
      [4, 4, "Developer preview · Live X and model validation pending."],
    ],
  },
];
const srt = [];
let globalTime = 0,
  number = 0;
function stamp(seconds) {
  const n = Math.round(seconds * 1000);
  return `${String(Math.floor(n / 3600000)).padStart(2, "0")}:${String(Math.floor(n / 60000) % 60).padStart(2, "0")}:${String(Math.floor(n / 1000) % 60).padStart(2, "0")},${String(n % 1000).padStart(3, "0")}`;
}
for (const f of frames) {
  const prefix = "el-" + f.id;
  const scope = `[data-composition-id="${f.id}"]`;
  const css = `${scope}{position:relative;width:100%;height:100%;overflow:hidden;font-family:sans-serif;color:#dce9e5} ${scope} *{box-sizing:border-box} ${scope} .clip{position:absolute} ${scope} .ground{inset:0;background:#101b20} ${scope} .header{position:absolute;left:100px;right:100px;top:55px;display:flex;justify-content:space-between;align-items:center;font-size:20px;letter-spacing:2px;color:#b4dbc4} ${scope} .proof{font-size:16px;letter-spacing:1px;color:#9eb3b6} ${scope} .title{position:absolute;left:100px;top:225px;width:510px;margin:0;font-size:64px;font-weight:600;line-height:1.1;letter-spacing:-2px} ${scope} .title span,${scope} .body span{display:block} ${scope} .body{position:absolute;left:100px;top:520px;width:510px;font-size:27px;line-height:1.55;color:#9eb3b6;margin:0} ${scope} .body span{margin-top:16px} ${scope} .media{position:absolute;left:720px;top:130px;width:1100px;height:820px;object-fit:contain;border:1px solid #375557;border-radius:12px;background:#0d141a} ${scope} .caption{left:100px;right:100px;bottom:40px;height:65px;display:flex;align-items:center;justify-content:center;border-top:1px solid #375557} ${scope} .caption p{margin:0;padding-top:15px;font-size:26px;line-height:1.2;font-weight:500;text-align:center;color:#dce9e5} ${scope} .intro-title{left:140px;top:275px;width:1500px;font-size:124px;line-height:1.04;letter-spacing:-5px} ${scope} .intro-title span{color:#b4dbc4} ${scope} .intro-body{left:145px;top:615px;width:1550px;font-size:36px} ${scope} .source{position:absolute;left:145px;top:745px;font-size:34px;color:#b4dbc4;letter-spacing:0} ${scope} .index{position:absolute;left:100px;bottom:150px;color:#b4dbc4;font-size:18px;letter-spacing:2px} ${scope} .line{position:absolute;left:145px;top:220px;width:80px;height:4px;background:#b4dbc4}`;
  const media =
    f.media && !f.media.endsWith(".webm")
      ? `<img id="${prefix}-media" class="clip media" src="assets/${f.media}" alt="Actual network settings" data-start="0" data-duration="${f.duration}" data-track-index="1">`
      : "";
  const captions = f.captions
    .map(([start, duration, text], i) => {
      srt.push(
        `${++number}\n${stamp(globalTime + start)} --> ${stamp(globalTime + start + duration)}\n${text}\n`,
      );
      return `<div id="${prefix}-caption-slot-${i}" class="clip caption" data-start="${start}" data-duration="${duration}" data-track-index="3" data-layout-allow-caption-zone><p id="${prefix}-caption-${i}">${text}</p></div>`;
    })
    .join("\n");
  const timeline = `const tl=gsap.timeline({paused:true});tl.fromTo('#${prefix}-title',{opacity:0,y:16},{opacity:1,y:0,duration:.5,ease:'power3.out'},0);tl.fromTo('#${prefix}-body',{opacity:0,y:10},{opacity:1,y:0,duration:.5,ease:'power3.out'},${f.intro ? 1.3 : 0.3});${f.source ? `tl.fromTo('#${prefix}-source',{opacity:0,y:10},{opacity:1,y:0,duration:.5,ease:'power3.out'},3.5);` : ""}${f.captions.map(([start], i) => `tl.fromTo('#${prefix}-caption-${i}',{opacity:0},{opacity:1,duration:.15,ease:'none'},${start});`).join("")}window.__timelines['${f.id}']=tl;`;
  await writeFile(
    `${root}/compositions/frames/${f.id}.html`,
    `<template><div id="${prefix}-root" data-composition-id="${f.id}" data-width="1920" data-height="1080" data-duration="${f.duration}"><style>${css}</style><div id="${prefix}-ground" class="clip ground" data-start="0" data-duration="${f.duration}" data-track-index="0"></div><div class="header"><span>X FOCUS MODE / SWARMKIND</span><span class="proof">${f.intro ? "OPEN SOURCE · PREVIEW" : "DEMO DATA · SCRIPTED MODEL RESPONSES"}</span></div>${f.intro ? '<div class="line"></div>' : ""}<h1 id="${prefix}-title" class="title ${f.intro ? "intro-title" : ""}">${f.title}</h1><p id="${prefix}-body" class="body ${f.intro ? "intro-body" : ""}">${f.body}</p>${media}${f.source ? `<p id="${prefix}-source" class="source">github.com/swarmkind/x-focus-mode</p>` : ""}${!f.intro ? `<div class="index">${f.id.slice(0, 2)} / 06</div>` : ""}${captions}<script>${timeline}</script></div></template>`,
  );
  globalTime += f.duration;
}
await writeFile(`${root}/captions.srt`, srt.join("\n"));
let board = await readFile(`${root}/STORYBOARD.md`, "utf8");
await writeFile(
  `${root}/STORYBOARD.md`,
  board.replaceAll("- status: outline", "- status: animated"),
);
console.log("Built six actual-feature scenes, 60 seconds.");

let start = 0;
const hosts = [],
  videos = [];
for (const f of frames) {
  hosts.push(
    `<div id="scene-${f.id}" class="clip scene" data-composition-id="${f.id}" data-composition-src="compositions/frames/${f.id}.html" data-start="${start}" data-duration="${f.duration}" data-width="1920" data-height="1080" data-track-index="0"></div>`,
  );
  if (f.media?.endsWith(".webm"))
    videos.push(
      `<video id="media-${f.id}" class="clip media" src="assets/${f.media}" muted playsinline data-start="${start}" data-duration="${f.duration}" data-track-index="1"></video>`,
    );
  start += f.duration;
}
await writeFile(
  `${root}/index.html`,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>X Focus Mode — demonstration</title><script src="assets/gsap.min.js"></script><style>html,body{margin:0;width:100%;height:100%;background:#101b20}#root{position:relative;width:100%;height:100%;overflow:hidden}.scene{position:absolute;inset:0}.media{position:absolute;left:720px;top:130px;width:1100px;height:820px;object-fit:contain;border:1px solid #375557;border-radius:12px;background:#0d141a;z-index:2;box-sizing:border-box}</style></head><body><div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-duration="60">${hosts.join("")}${videos.join("")}</div><script>window.__timelines.main=gsap.timeline({paused:true});</script></body></html>`,
);
