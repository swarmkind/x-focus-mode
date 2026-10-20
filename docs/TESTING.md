# Verification record

Developer preview, 20 October 2026. Test source is included so results can be reproduced; this is not a production certification.

## Executed checks

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | Passed | Extension and Cloudflare relay configurations |
| Unit and SQLite tests | 8 passed | Signed schema, tampering, expiry, revision ordering, model parser, endpoint boundaries, atomic database updates and capacity |
| Local relay integration | Passed | Real Worker/D1 emulator: submissions, rejected replay/tampering/private fields, withdrawals, incremental sync, peer capacity and rediscovery |
| Installed Chrome extension | 15 scenarios passed | Two isolated Chrome profiles, actual unpacked content script, worker and offscreen page; fictional X-shaped feed and scripted model |
| Native WebRTC | Passed locally | Second installation retrieved signed reports over a real data channel after its cache was cleared |
| Distribution off switch | Passed | Offscreen document and its connections close immediately |
| API boundary | Passed with mocked provider | Key goes only to the configured HTTPS provider; unknown visibility is excluded |
| Keyboard Reveal | Passed | Focus retained; hidden native content becomes available immediately |
| Fail-open timeout | Passed | A slow model releases the pending cover after one second and does not hide already-visible text later |

[Machine-readable browser results](browser-results.json) include the exact Chrome version, timestamps and timings. The measured Reveal operation is an in-page interaction, not a claim about full input-to-display latency. The long-task observer covers the whole fixture page; it is not an extension-only CPU profile.

Other browser assertions cover initial consent, own/protected exclusions, personal highlighting, explicit human confirmation, privacy of report payloads, DOM recycling, retained badges on detail pages, manual Hide with community auto-blur disabled, SPA navigation and byte-budget refusal.

## Reproduce

Use Node 24+, `npm ci`, then `npm run check` and `npm test`. Initialize the local relay schema and run `npm run dev:relay` as documented in the root README. With that relay listening on port 8787, run `npm run test:relay` and `npm run test:browser` sequentially. Install the Playwright Chromium binary first, or set `CHROME_PATH` to Chrome for Testing.

Browser tests clear **only the local D1 emulator's report table**. Use disposable local development data. The test extension allows a loopback fixture host and a mocked provider; the release build excludes both. Tests do not open personal Chrome profiles or use personal X/provider credentials. The relay limits connections per minute; repeated test runs may need a new rate window.

## Unverified release gates

- **Live X:** logged-in home feed, current metadata format, virtualized/recycled production DOM and protected-content handling. A direct isolated visit did not provide a usable live feed. Fixture success does not establish live compatibility.
- **Models:** real provider OAuth, real API responses, Ollama inference, classification quality and confidence calibration. The evaluation harness exists; no accuracy or minimum-model-size result is claimed.
- **Hardware:** tests ran on an Apple M2 Max with 64 GB RAM. No 8 GB machine, memory ceiling, sustained feed workload or battery measurement has been validated.
- **Network:** cross-network NAT traversal, large-swarm topology and hostile peers. Local WebRTC success is a narrower result; HTTPS fallback remains necessary.
- **Hosting:** no authenticated Cloudflare deployment, production CPU/storage measurements or public Swarmkind relay.
- **Review:** no independent security audit, comprehensive screen-reader test or Chrome Web Store approval.

## Demo provenance

The included development composition currently records actual extension interactions on **fictional posts with scripted model responses**. Daniel requested real public tweets for the final preview. That footage is pending an authorized dedicated X window or supplied recordings. The fixture composition is not the requested final video and is not a live-site test.

## Hosted CI

`docs/ci-check.yml` contains the Linux/Node 24 check-and-package workflow. GitHub rejected installation under `.github/workflows/` because the connected account token lacks the `workflow` scope. The source and package can still be published. To enable hosted CI, an authorized maintainer can move the template to `.github/workflows/check.yml` using GitHub or a credential permitted to edit workflows. Hosted CI has not run; local checks above have run.
