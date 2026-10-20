# v0.1.3 — compact post controls

- Replace the per-post banner with a native-sized 👎 button in X’s existing action row.
- Choose a rejection reason directly from a compact menu; explicit choices persist on this device.
- Float Reveal over blurred content and preserve community counts after revealing.
- Preserve post height, keyboard access and immediate corrections; dismiss menus on outside click, Escape or scrolling.
- Keep explicit choices when delayed model responses arrive.
- Add browser checks for unchanged height, narrow menus, persistence and late model responses.

Live X verification of this version is pending a manual extension reload. The existing demo and illustrated guides show v0.1.2.

# v0.1.2 — live X controls and real-tweet demo

- Position warnings above X's flex-row post content, restoring the original direction on removal.
- Keep Feedback and its controls from activating the underlying X post.
- Apply successful Incorrect feedback immediately and preserve it across card redraws; failed saves do not pretend to correct the post.
- Add regression coverage for actual X layout and Feedback click propagation/correction.
- Pass TypeScript, nine unit/SQLite tests and 20 installed-extension browser scenarios.
- Verify Hide, Reveal, Feedback and correction on the actual logged-in X home feed.
- Include a silent 60-second demo using only recorded X-window footage and original title/guide graphics. A mistaken model label is explicitly identified and corrected.

**Developer preview:** model quality remains unreliable. No public relay, Store listing, one-click model installer, 8 GB result or cross-network swarm guarantee. Real provider OAuth/API paths remain unverified; hosted CI still needs a credential with workflow permission. Live testing kept sharing/distribution off and published no reports.

Update unpacked installations by replacing the files, clicking Reload on the extension card, then reloading X.

---

# v0.1.1 — live-test fixes and launch materials

- Preserve unknown public visibility instead of treating it as restricted. Remote review/sharing still require affirmative eligibility.
- Disable optional Ollama thinking to avoid spending the request deadline on reasoning.
- Restore native inline styles and inert state when revealing or removing an overlay.
- More conservative prompt instructions for distress, charitable appeals, authorship claims and generic prose. Real local testing still found mistakes; see [EVALUATION.md](EVALUATION.md).
- Refreshed settings, original focus logo, @swarmkind attribution and the requested planned Buy Me a Coffee link, visibly marked as unclaimed/coming soon.
- Three illustrated guides, editable SVGs, PNG exports, social cover, quick start and researched distribution shortlist.
- Nine unit/SQLite tests and 18 installed-extension browser scenarios pass. Added repeated card replacement, native state restoration and 360 px settings checks.

**Still a developer preview:** the initial logged-in X session exposed bugs, but verification of the corrected extension requires a manual extension reload. The real-tweet demo video is pending that step; no final MP4 is included. No public relay, Store listing, one-click model installer, independently validated classifier, 8 GB result or cross-network swarm guarantee is claimed. Hosted CI is not active because the publishing credential cannot install workflows.

Update an unpacked installation by replacing its files, clicking Reload on the extension card, then reloading X.

---

## v0.1.0 — initial developer preview

An initial MIT-licensed implementation of X Focus Mode:

- MV3 overlay with per-category blur/colour/ignore, immediate Reveal, retained community warnings and explicit feedback.
- Direct personal API/OpenRouter OAuth support, existing local Ollama support, and community-only mode.
- Signed minimal reports, strict validation, bounded local cache, native WebRTC seeding and a self-hostable Cloudflare Worker/D1 relay.
- Consent, independent sharing/distribution controls, conservative public-feed eligibility and provider credential isolation.
- Reproducible release ZIP, local relay tests, two-profile Chrome tests and store submission materials.

**Preview limitations:** live logged-in X compatibility and real model/provider flows have not been verified. No public relay, Chrome Web Store listing, one-click local model installer, 8 GB hardware result or cross-network connectivity guarantee is included. Community claims can be wrong or coordinated. See TESTING.md and SECURITY.md before deployment.

The requested real-tweet demo video is pending live footage. Included fictional development recordings are test references, not that final preview.

Install the ZIP by extracting it and loading its directory through Chrome's Developer mode. Provider credits and any self-hosting charges are your responsibility; no automatic paid upgrades or paid TURN dependency are configured.
