# Verification record

Developer preview, 20 October 2026. Test source is included so results can be reproduced; this is not a production certification.

## Executed checks

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | Passed | Extension and Cloudflare relay configurations |
| Unit and SQLite tests | 9 passed | Signed schema, tampering, expiry, revision ordering, model parser, unknown visibility, endpoint boundaries, atomic database updates and capacity |
| Local relay integration | Passed | Real Worker/D1 emulator: submissions, rejected replay/tampering/private fields, withdrawals, incremental sync, peer capacity and rediscovery |
| Installed Chrome extension | 24 scenarios passed | Two isolated Chrome profiles, actual unpacked content script, worker and offscreen page; fictional X-shaped feed and scripted model |
| Native WebRTC | Passed locally | Second installation retrieved signed reports over a real data channel after its cache was cleared |
| Distribution off switch | Passed | Offscreen document and its connections close immediately |
| API boundary | Passed with mocked provider | Key goes only to the configured HTTPS provider; unknown visibility is excluded |
| Keyboard controls | Passed | Reveal transfers focus to 👎; arrow keys and Escape work in the rejection menu |
| Compact post layout | Passed | Exact height matches the inactive extension baseline; open menus and blurs add no height |
| Narrow post menu | Passed | Menu fits a 380 px viewport; outside click and scrolling dismiss it |
| Worker suspension | Passed | Chrome stopped the real worker; rejection restarted it, saved the chosen category and could be undone |
| Explicit rejection | Passed | Unflagged posts can be rejected; choices persist across refresh, can be undone, and survive delayed model results |
| Fail-open timeout | Passed | A slow model releases the pending cover after one second and does not hide already-visible text later |
| Repeated DOM replacement | Passed | 30 alternating post replacements in one card; one overlay remains per card |
| Native state restoration | Passed | Reveal restores pre-existing inline filter/pointer styles, priorities and inert attribute |
| Narrow settings window | Passed | No horizontal overflow at 360 px; maker and planned coffee links present |
| Live X interaction | v0.1.2 passed; Passed on v0.1.4; v0.1.5 ring reload pending | v0.1.4: rejection saved locally, Reveal and correction worked without leaving the feed; all states kept the post at 178 px. Sharing/distribution off |
| Local Ollama inference | Executed | Qwen3.5:latest, 9.7B Q4_K_M, 64 GB M2 Max; see EVALUATION.md for failures and limits |

[Machine-readable browser results](browser-results.json) include the exact Chrome version, timestamps and timings. The measured Reveal operation is an in-page interaction, not a claim about full input-to-display latency. The long-task observer covers the whole fixture page; it is not an extension-only CPU profile.

Other browser assertions cover initial consent, own/protected exclusions, personal highlighting, explicit human confirmation, privacy of report payloads, DOM recycling, retained badges on detail pages, manual Hide with community auto-blur disabled, SPA navigation and byte-budget refusal.

## Reproduce

Use Node 24+, `npm ci`, then `npm run check` and `npm test`. Initialize the local relay schema and run `npm run dev:relay` as documented in the root README. With that relay listening on port 8787, run `npm run test:relay` and `npm run test:browser` sequentially. Install the Playwright Chromium binary first, or set `CHROME_PATH` to Chrome for Testing.

Browser tests clear **only the local D1 emulator's report table**. Use disposable local development data. The test extension allows a loopback fixture host and a mocked provider; the release build excludes both. Tests do not open personal Chrome profiles or use personal X/provider credentials. The relay limits connections per minute; repeated test runs may need a new rate window.

## Unverified release gates

- **Live X:** v0.1.3’s menu and blur preserved the live post height; live use exposed and led to a fix for worker suspension. v0.1.4 passed live rejection, Reveal and correction checks with a constant 178 px post height. v0.1.5 only removes the partial lower ring; live visual confirmation awaits reload. v0.1.2 was manually reloaded and tested on the authorized logged-in home feed. Live testing found and fixed flex-row layout, Feedback click propagation and delayed correction display. Current public-visibility coverage, protected-content handling and sustained workloads still need broader live validation. Unknown visibility cannot be shared or sent to a remote provider.
- **Models:** real provider OAuth and real API responses remain unverified. Existing local Ollama completed 16 calibration and 12 fresh synthetic challenge cases. Real classification quality, confidence calibration and a minimum model size are not established; see [evaluation details](EVALUATION.md).
- **Hardware:** tests ran on an Apple M2 Max with 64 GB RAM. No 8 GB machine, memory ceiling, sustained feed workload or battery measurement has been validated.
- **Network:** cross-network NAT traversal, large-swarm topology and hostile peers. Local WebRTC success is a narrower result; HTTPS fallback remains necessary.
- **Hosting:** no authenticated Cloudflare deployment, production CPU/storage measurements or public Swarmkind relay.
- **Review:** no independent security audit, comprehensive screen-reader test or Chrome Web Store approval.

## Demo provenance

The existing video and illustrated guides show the previous v0.1.2 interface. Video production is paused while the compact controls are reviewed.

The final 60-second demo uses real X-window recordings from 20 October 2026. Native macOS capture targeted one dedicated Chrome window, with no audio input. Selected footage is cropped to X content; no desktop or other app appears. Captions identify the local model and explicitly show a mistaken doomering classification being corrected. These are actual extension interactions, not composited UI. The pending cover had already timed out; Hide reapplied the blur before recording. This is disclosed in the video and does not establish sub-second inference.

Live testing used Qwen3.5:latest through existing local Ollama, with sharing and distribution disabled. No demonstration reports were published. The classifier made conspicuous mistakes on ordinary posts; successful overlay mechanics do not establish useful classification quality. The video is a developer preview, not an accuracy or speed benchmark.

The updated composition passed HyperFrames 0.8.181 lint, runtime, layout, motion and contrast checks. The delivered MP4 was probed as exactly 60 seconds, 1920 × 1080, 30 fps, one video stream and no audio stream. Decoded frames at 3, 8, 12, 24, 30, 37, 47 and 57 seconds were inspected; blur, Reveal, Feedback and corrected state are visible. The animation-map review flagged overlapping local scene clocks and reading holds; the assembled runtime and visual checks showed no visible collision. Development fixture captures remain separately labelled and are not used in the final timeline. Capture provenance is recorded in `videos/x-focus-mode/capture/live/README.md`.

The three original 1080 × 1350 guides and 1200 × 630 cover were exported and visually checked. The export script also checks text bounds. These assets are outside the extension package and add no installed runtime weight.

## Hosted CI

`docs/ci-check.yml` contains the Linux/Node 24 check-and-package workflow. GitHub rejected installation under `.github/workflows/` because the connected account token lacks the `workflow` scope. The source and package can still be published. To enable hosted CI, an authorized maintainer can move the template to `.github/workflows/check.yml` using GitHub or a credential permitted to edit workflows. Hosted CI has not run; local checks above have run.
