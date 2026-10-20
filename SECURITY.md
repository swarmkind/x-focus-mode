# Security model and release limitations

Report security issues through a private GitHub security advisory when enabled. Until then, do not publish credentials, private posts or exploitable personal data in public issues; a minimal synthetic reproduction is sufficient.

## Trust boundaries

- The X page and post text are untrusted. Content messages are limited to known schemas and a top-frame X home/detail sender. They cannot select arbitrary fetch URLs, read keys or configure endpoints.
- Options messages require the exact packaged options page. Service URLs require HTTPS, except loopback Ollama. Redirects and ambient credentials are disabled. Keys are bound to the exact provider endpoint.
- Provider outputs are strict structured data. Unknown fields, mismatched IDs and malformed responses are rejected. Missing context or uncertainty suppresses categories. Prompt injection can still affect model judgement; no output executes code, follows URLs or invokes tools.
- Reports use native ECDSA P-256/SHA-256 with strict fields, canonical bytes, bounded sizes and fixed categories. Peers verify signatures before storage. D1 revisions update atomically, and tombstones cannot shorten earlier expiry.
- Signing authenticates a pseudonymous key, not truth, a unique human, model identity, public X visibility or the absence of coordination. Anyone can generate keys. Community auto-blur is optional and off by default.
- The page-world visibility adapter can be spoofed by a compromised X page. Its conservative checks prevent accidental sharing on unsupported layouts; they do not constitute cryptographic evidence of account ownership or public visibility.

## Availability and abuse

Four peers, bounded message size/rate, application byte budgets, bounded cache, queue and inference concurrency. No paid TURN. Primary misses fail without disabling personal AI. The first relay has 16-record per-tweet and 60,000-record total admission ceilings. It can fill, be censored by an operator or be flooded by Sybil keys. Early attackers could occupy per-tweet slots. Signatures do not solve this.

The coordinator uses transient per-IP counters and a 256-socket admission cap. Counters can reset after object restart/hibernation and shared networks may collide. These are basic admission controls, not robust DDoS or Sybil prevention. Platform free-tier caps remain the financial backstop. Never enable automatic paid upgrades expecting the protocol to prevent abuse.

Cache freshness is eventual. Positive peer results may be served before a primary refresh; warnings say they are unverified claims. Withdrawals propagate through incremental sync and lookups. A malicious peer can omit newer records, and disconnected peers can show older claims until refreshed or expired.

## Preview gates

- Actual logged-in X DOM and metadata compatibility is not yet verified in this environment.
- OAuth and paid provider requests have not been exercised with a real account.
- No classifier quality or minimum model-size claim is supported yet.
- 8 GB hardware and distinct-network NAT traversal need external testing.
- Cloudflare production CPU, storage and account quotas require deployment measurements.
- Formal accessibility and security audits have not been performed.

See `docs/TESTING.md` for the checks that were actually run. Do not advertise this preview as bulletproof, anonymous, always available or infallible.
