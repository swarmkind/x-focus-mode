# X Focus Mode privacy policy

Effective: 20 October 2026. Applies to the Swarmkind reference source and preview package. Independently operated relays and modified extensions may behave differently. Preview contact: open a non-sensitive issue in the [project repository](https://github.com/swarmkind/x-focus-mode/issues).

## Activation and permissions

Both “Help distribute community reports” and “Share eligible feed flags” start checked but remain inactive until you read the in-product disclosure, check consent and save. You can disable them independently. Turning distribution off closes the offscreen document and peer connections; your own model filtering remains available. Removing consent stops new processing and cancels outstanding service requests when settings are saved.

The content scripts run on x.com. They inspect loaded Home feed posts and display existing warnings on individual post pages. The page-world adapter observes only HomeTimeline/HomeLatestTimeline response metadata to establish explicit public visibility. It does not collect X credentials or reuse private X APIs outside normal browsing. Parsing is bounded and visibility hints are not server-authenticated proof. When the adapter cannot establish eligibility, nothing is contributed; API classification also stays off for that post. Local Ollama may classify uncertain-visibility feed text locally. Own/protected posts detected by the adapter are excluded entirely.

Optional host access is requested for the provider and relay you select. No browsing access to other sites is used. Identity permission supports OpenRouter sign-in; no Google identity/profile access is requested. Offscreen and alarms permissions support the optional WebRTC relay lifecycle. Chrome may suspend or terminate extension contexts; continuous availability is not guaranteed.

## Processing on this device

Settings, explicit interests, corrections, credentials and a pseudonymous signing key use Chrome local extension storage. API keys are associated with the exact endpoint and are inaccessible to content scripts; they are not Chrome-synced. Storage is not an OS credential vault. Someone who controls your browser profile may access it.

Assessment cache is session-only and bounded to 500 entries. It stores classification results and hashed cache keys, not post text. Feed text remains temporarily in a bounded in-memory work queue and is not written to disk by the application. Reveal state remains in memory. Explicit corrections are bounded to 1,000 IDs locally. Shared signed reports use a bounded IndexedDB cache, including unrelated assigned buckets; the cache is not exclusively a list of your feed posts. Local byte counters/cursors support replication and limits. No advertising, analytics SDKs or user tracking service is included.

“Clear cached reports” clears shared reports and session assessments. It preserves settings, credentials, the signing identity, local corrections and daily transfer budgets. “Remove saved provider keys” removes stored API credentials. Uninstalling removes extension-managed local data. Provider-side key revocation is separate.

## Your selected model provider

API mode transmits eligible public post text, available quoted text, explicit interests, model name and a classification prompt directly to your configured endpoint. Your key is included only in that direct provider request. The provider's privacy, retention and billing policies apply. Requests do not pass through Swarmkind. Ollama mode calls a localhost/loopback endpoint. Community-only mode makes no model requests. Images, videos and complete threads are not fetched for classification in this version.

## Community data

The public report schema allows only: protocol version, exact tweet ID, fixed category codes, human/model source, model identifier, pseudonymous public key, signature, monotonically increasing revision, issue time, expiry and withdrawal status. There are no free-form reasons or post bodies. Revealing or dwelling on a post never confirms a report. “Accurate” explicitly creates a human report where eligible; “Incorrect” records a personal correction and, where sharing is enabled and eligible, publishes a withdrawal of your own report.

A public signing key links contributions. Model identifiers and “human” labels are self-declared. Reports are not anonymised against correlation with public X content. A relay receives lookup IDs even if no report exists; the application does not persist lookup queries or IP addresses in D1. It uses transient IP-based admission counters. The relay and its infrastructure can still observe traffic, and hosting/security logs may exist under their operator's policies.

## Peer connections

Opted-in peers seed bounded cache portions while Chrome is running and online, even with X closed. Native WebRTC uses the configured relay for signalling and Cloudflare's public STUN endpoint for connectivity. Signalling exchanges ephemeral session IDs, bucket assignments, SDP and ICE candidates; these may expose IP addresses. This connection data is transient, outside the report database. Peers learn requested tweet IDs and connection IPs. There is no TURN anonymity layer. Payload budgets exclude transport, STUN and signalling overhead; they are application transfer limits, not an exact cap on all network bytes.

Reports expire within 30 days. Signed withdrawals supersede older reports and are retained long enough to cover their lifetime. Peers can be offline, stale or malicious. Copies outside your device cannot be recalled, and third parties may retain public reports beyond our expiry rules. Do not publish information you require to be erasable from every copy.

## Controls and policy changes

Use settings to change modes, remove provider keys, disable either network option or withdraw consent. You can choose another compatible relay or use no community relay. Material changes to data flows require updated disclosures and renewed consent in a future release. This preview does not yet have a deployed Swarmkind relay or public store listing.
