# Chrome Web Store submission pack

Status: **prepared preview; not submitted**. Do not submit as a fully verified release until the live X, account and hardware gates in TESTING.md are reviewed. Publisher registration, verified contact information and any Google fee/terms are completed by the account owner.

## Listing copy

**Name:** X Focus Mode

**Short description:** A personal attention filter for X: instant reveal, your own AI, and optional signed community warnings.

**Detailed description:**

Choose what deserves your attention on X. X Focus Mode can blur or colour posts labelled as ragebait, doomering, engagement farming or suspected AI slop. Reveal anything instantly and leave explicit feedback when a label is right or wrong. Labels are fallible judgements, not proof of intent or AI authorship.

Connect your own OpenRouter account or API-compatible provider, run an existing Ollama model locally, or use community warnings only. API charges belong to your selected provider. Relevant posts can be highlighted using interests you choose.

Optional community participation shares only small signed reports and helps distribute cached reports to other users. Read the disclosure before enabling it. Distribution may continue while Chrome is running with X closed; you can disable sharing and distribution independently. Community auto-blur is off by default.

Open source under MIT. No affiliation with X. See the repository for source, self-hosting, privacy details and limitations.

**Category:** Productivity / Workflow & Planning (choose the matching current dashboard category).

**Language:** English.

**Homepage/source:** https://github.com/swarmkind/x-focus-mode

**Privacy policy:** https://github.com/swarmkind/x-focus-mode/blob/main/docs/PRIVACY.md

**Support:** https://github.com/swarmkind/x-focus-mode/issues

## Packaged assets

- `artifacts/x-focus-mode-0.1.0.zip`: upload package; only release `dist/` contents.
- `artifacts/SHA256SUMS`: integrity checksum.
- `dist/icon128.png`: listing icon; original mark, no X logo reuse.
- `docs/store-feed.png`, `docs/store-settings.png`: 1280×800 actual extension captures on clearly labelled fictional data. Replace the feed screenshot with a verified live capture before final submission; do not misrepresent fixture model output as real model accuracy.
- Final video pending real public X footage. The existing composition is a development reference; no final MP4 is included.

## Permission justification

| Permission | Reason |
| --- | --- |
| `https://x.com/*` | Observe loaded home-feed posts and add revealable filters/warnings |
| `storage` | Local settings, credentials, signing identity and assessment cache |
| `identity` | User-initiated OpenRouter OAuth PKCE redirect flow, not Google profile access |
| `offscreen` | Optional native WebRTC peer connections while Chrome runs |
| `alarms` | Resume optional distribution and prune expired local cache |
| Optional HTTPS hosts | Only the API provider and compatible relay the user explicitly configures |
| Optional localhost / 127.0.0.1 | Existing Ollama on loopback; no LAN scanning |

No remote executable code, eval, downloaded JavaScript or embedded model weights. AI responses are data parsed against a fixed schema. The package ships all executable code.

## Data-use disclosures for the dashboard

Declare **website content**, **web history/URLs or identifiers** as applicable to tweet IDs and feed processing, and **authentication information** for locally stored provider credentials. Do not select “no user data” merely because some processing is local. Explain direct selected-provider processing and optional sharing of public report metadata. No advertising, sale, creditworthiness or unrelated profiling use. Confirm Limited Use declarations only after the account owner has reviewed the actual implementation and current Google form.

## Reviewer instructions

1. Install the package and open its settings. No network activity occurs until explicit consent and save.
2. A real X login is required to exercise home-feed behaviour. Use a reviewer account; never supply a personal X password to this project.
3. Connect a reviewer-controlled provider, or run Ollama; alternatively choose community-only with a deployed reviewer relay.
4. Check Reveal, retained warning badge, explicit Accurate/Incorrect feedback, own/protected exclusions, and independent network switches.
5. For a deterministic offline demonstration, the public repository's test harness builds a separate loopback-only fixture extension and runs the same implementation with fictional data. The test origin and mock model are **not** in the upload package.
6. The preview requires live-site verification before final submission. Do not claim an undisclosed server or test account exists.

## Final account steps

Register/verify the publisher account, upload the verified ZIP and sized screenshots, complete privacy disclosures, set distribution/visibility, then submit for review. Google's approval and review timing are external. The reference build cannot complete registration, accept terms or pay fees on the user's behalf without the required account interaction.
