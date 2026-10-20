# Approved build and release gates

X Focus Mode: MIT Chrome MV3 extension, direct personal model calls, optional Ollama, signed community flags, Cloudflare bootstrap relay, bounded native WebRTC report seeding. Plain TypeScript/HTML/CSS; no model weights in extension.

## Delivery order
1. Shared bounded signed protocol and meaningful tests.
2. Feed adapter, accessible blur/reveal, options/onboarding, providers, local settings and cache.
3. Worker/D1 primary relay and hibernating Durable Object signalling.
4. Offscreen WebRTC: 64 buckets, up to two assigned, four peers, 20 MB cache, 10 MB/day upload and background download; 300 ms peer miss falls back to primary.
5. Browser verification, privacy/security checks, documentation, GitHub preview release and store materials.
6. Actual-feature 60-second 1080p captioned demo, source included.

## Required behaviour
Only loaded public feed posts may be contributed, never own/protected/DM/profile/bookmark/account activity. Unknown eligibility stays local. Two separate network settings initially checked but inactive until informed consent. Explicit feedback, never implicit confirmation from Reveal. Personal relevance remains local. No content or free text in shared reports. Provider credentials remain in trusted extension contexts. Sharing and seeding independent; disabling closes peers immediately. Optional community auto-blur, default badges only. Late classifications do not hide an already-read card. At most one second pending cover, then visible unreviewed.

Reports carry exact tweet ID, standard categories, source/model, pseudonymous public key, signature, revision and expiry. Authorship signatures are not proof of truth or model identity. Human/model sources distinct. Signed withdrawals, bounded retention, no request-body logging. Public keys link reports, peers can see IPs and requested IDs; public distributed data cannot be recalled.

## Honest external gates
Cloudflare account authentication and Google publisher registration are required for deployment/submission. Real provider credentials required for live model evaluation. A physical 8 GB machine and two independent network connections are required before claiming those performance/connectivity results. No paid upgrades or TURN. Live X DOM/public visibility must be verified; conservative exclusions remain until supported. Preview releases must state unverified gates clearly.
