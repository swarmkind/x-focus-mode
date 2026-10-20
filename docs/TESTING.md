# Verification record

Developer preview, 20 October 2026. Test source is included so results can be reproduced; this is not a production certification.

## Executed checks

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | Passed | Extension and Cloudflare relay configurations |
| Unit and SQLite tests | 9 passed | Signed schema, tampering, expiry, revision ordering, model parser, unknown visibility, endpoint boundaries, atomic database updates and capacity |
| Local relay integration | Passed | Real Worker/D1 emulator: submissions, rejected replay/tampering/private fields, withdrawals, incremental sync, peer capacity and rediscovery |
| Installed Chrome extension | 18 scenarios passed | Two isolated Chrome profiles, actual unpacked content script, worker and offscreen page; fictional X-shaped feed and scripted model |
| Native WebRTC | Passed locally | Second installation retrieved signed reports over a real data channel after its cache was cleared |
| Distribution off switch | Passed | Offscreen document and its connections close immediately |
| API boundary | Passed with mocked provider | Key goes only to the configured HTTPS provider; unknown visibility is excluded |
| Keyboard Reveal | Passed | Focus retained; hidden native content becomes available immediately |
| Fail-open timeout | Passed | A slow model releases the pending cover after one second and does not hide already-visible text later |
| Repeated DOM replacement | Passed | 30 alternating post replacements in one card; one overlay remains per card |
| Native state restoration | Passed | Reveal restores pre-existing inline filter/pointer styles, priorities and inert attribute |
| Narrow settings window | Passed | No horizontal overflow at 360 px; maker and planned coffee links present |
| Local Ollama inference | Executed | Qwen3.5:latest, 9.7B Q4_K_M, 64 GB M2 Max; see EVALUATION.md for failures and limits |

[Machine-readable browser results](browser-results.json) include the exact Chrome version, timestamps and timings. The measured Reveal operation is an in-page interaction, not a claim about full input-to-display latency. The long-task observer covers the whole fixture page; it is not an extension-only CPU profile.

Other browser assertions cover initial consent, own/protected exclusions, personal highlighting, explicit human confirmation, privacy of report payloads, DOM recycling, retained badges on detail pages, manual Hide with community auto-blur disabled, SPA navigation and byte-budget refusal.

## Reproduce

Use Node 24+, `npm ci`, then `npm run check` and `npm test`. Initialize the local relay schema and run `npm run dev:relay` as documented in the root README. With that relay listening on port 8787, run `npm run test:relay` and `npm run test:browser` sequentially. Install the Playwright Chromium binary first, or set `CHROME_PATH` to Chrome for Testing.

Browser tests clear **only the local D1 emulator's report table**. Use disposable local development data. The test extension allows a loopback fixture host and a mocked provider; the release build excludes both. Tests do not open personal Chrome profiles or use personal X/provider credentials. The relay limits connections per minute; repeated test runs may need a new rate window.

## Unverified release gates

- **Live X:** the authorized logged-in home feed was inspected. An unknown-visibility bug caused overlays to disappear; the metadata adapter now preserves unknown state rather than marking it restricted. The installed extension requires a manual reload before the fix can be verified in that browser. The tool blocks extension-management pages. Production scrolling, current public-visibility coverage and protected-content handling remain live verification gates. Fixture success does not establish live compatibility.
- **Models:** real provider OAuth and real API responses remain unverified. Existing local Ollama completed 16 calibration and 12 fresh synthetic challenge cases. Real classification quality, confidence calibration and a minimum model size are not established; see [evaluation details](EVALUATION.md).
- **Hardware:** tests ran on an Apple M2 Max with 64 GB RAM. No 8 GB machine, memory ceiling, sustained feed workload or battery measurement has been validated.
- **Network:** cross-network NAT traversal, large-swarm topology and hostile peers. Local WebRTC success is a narrower result; HTTPS fallback remains necessary.
- **Hosting:** no authenticated Cloudflare deployment, production CPU/storage measurements or public Swarmkind relay.
- **Review:** no independent security audit, comprehensive screen-reader test or Chrome Web Store approval.

## Demo provenance

The included development composition records actual extension interactions on **fictional posts with scripted model responses**. Daniel requested real public tweets and authorized a logged-in X tab. A real feed still was captured locally, but successful live filter/Reveal footage is pending the corrected extension reload. No final real-tweet MP4 is delivered. The fixture composition is not that final video. Live testing has sharing/distribution disabled and does not publish demonstration flags.

The existing 60-second development composition passed HyperFrames 0.8.181 lint, runtime, layout and contrast checks after the renderer update. This validates the development composition's structure, not live footage or product accuracy.

The three original 1080 × 1350 guides and 1200 × 630 cover were exported and visually checked. The export script also checks text bounds. These assets are outside the extension package and add no installed runtime weight.

## Hosted CI

`docs/ci-check.yml` contains the Linux/Node 24 check-and-package workflow. GitHub rejected installation under `.github/workflows/` because the connected account token lacks the `workflow` scope. The source and package can still be published. To enable hosted CI, an authorized maintainer can move the template to `.github/workflows/check.yml` using GitHub or a credential permitted to edit workflows. Hosted CI has not run; local checks above have run.
