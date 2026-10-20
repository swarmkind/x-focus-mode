# Signed flag protocol v1

Public, independently implementable, MIT reference code: `shared/protocol.ts`.

## Report

All fields below are required. Unknown fields are rejected. JSON body limit: 2,048 bytes. All string values are ASCII under the schema.

| Field | Type / constraint |
| --- | --- |
| `v` | integer `1` |
| `tweetId` | decimal string, 1–20 digits, no leading zero |
| `categories` | unique subset of `ragebait`, `doomering`, `engagement_farming`, `suspected_ai_slop` |
| `source` | `human` or `model` (self-declared) |
| `model` | empty for human; 1–96 printable ASCII characters for model |
| `publisher` | base64url unpadded DER SPKI P-256 public key, 122 characters |
| `revision` | positive safe integer, strictly increases per publisher/tweet |
| `issuedAt` | safe integer UTC epoch milliseconds; at most 5 minutes in the future |
| `expiresAt` | safe integer UTC epoch milliseconds, after issue/receipt time, at most 30 days after issue |
| `withdrawn` | boolean; true requires empty categories, false requires at least one |
| `signature` | base64url unpadded 64-byte IEEE P1363 ECDSA signature (`r || s`) |

The signed bytes are UTF-8 JSON of this **array**, with categories sorted lexicographically:

```text
[v,tweetId,sortedCategories,source,model,publisher,revision,issuedAt,expiresAt,withdrawn]
```

Use native ECDSA P-256 with SHA-256. DER-encoded ECDSA signatures are not the wire format. No alternative JSON canonicaliser is needed because the signed shape is an ordered tuple with bounded ASCII values. The original object field ordering does not affect the signature.

Publisher/tweet is the record identity. New revisions must also have issue time at least the earlier issue time and expiry at least the earlier expiry. This prevents a short-lived withdrawal disappearing before an older report can no longer be replayed. Model and human revisions from one publisher replace one another; explicit human corrections take precedence in the reference client.

## HTTPS API

Every body uses `application/json`. Requests omit cookies and credentials. Lookups use POST so tweet IDs are not embedded in ordinary URL access logs.

- `POST /v1/report`: one signed report. `200` accepted; `409` duplicate/stale; `400` malformed/invalid; `429` rate limited; `503` exhausted capacity.
- `POST /v1/lookup`: `{ "ids": ["123"] }`, 1–4 IDs. Returns `{ "reports": [...] }`, including withdrawals so clients can supersede old records.
- `POST /v1/sync`: `{ "bucket": 0, "cursor": 0 }`. Returns at most 32 reports and the last returned database sequence as `cursor`. A revision receives a new sequence. Empty pages keep the cursor. Cursors are opaque and scoped to the relay; resetting a relay requires clients to reset its cursors.
- `GET /health`: protocol and retention metadata.

Bucket: the first byte of SHA-256(UTF-8(tweetId)) modulo 64. A node seeds portions of two randomly assigned buckets. It is not required to possess a whole bucket.

## Signalling and peers

`GET /v1/peers?buckets=a,b` upgrades to WebSocket. The server assigns an ephemeral random ID and supplies up to four peers. Outbound `{type:"signal",to,description}` or `{type:"signal",to,candidate}` forwards a bounded SDP description/ICE candidate with a server-assigned `from`. No tweet text or signing identity is used in signalling. Attachments hold transient socket metadata, not a persistent user table.

Native WebRTC data channel label: `xfm-v1`. Bounded JSON messages:

```json
{"type":"get","request":"random-request-id","ids":["123"]}
```

```json
{"type":"reports","request":"same-request-id","reports":[]}
```

At most 8 requested IDs and 32 returned reports per peer response. Every report is independently verified. Unsolicited or late responses are ignored. Four concurrent peers, 100 KB maximum inbound message, 60 messages/minute/peer, backpressure and persistent daily byte accounting apply. A 300 ms peer deadline falls back to the primary; empty peer responses never establish nonexistence.

There is no consensus, global identity registry, blockchain, model attestation, guaranteed erasure or guarantee of complete results. Hostile peers can withhold valid updates. Positive cached warnings can be stale, and public counts are reports, not verified unique people. These are explicit properties of version 1.

Peers advertise up to four available connection slots. Discovery excludes full peers, prefers shared buckets and randomizes ties. Clients rediscover during the existing five-minute synchronization cycle when they have spare capacity. These are advisory hints; receiving clients still enforce their own limits. This does not provide global routing or large-swarm connectivity guarantees.
