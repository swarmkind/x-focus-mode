# Run a compatible relay

The deployable source and schema are included. Cloudflare authentication and account registration are operator tasks; the checked-in configuration deliberately contains a placeholder database ID. No deployment has been made from this preview.

## Cloudflare

Use a **Free** Workers account and SQLite-backed Durable Objects. Do not enable paid upgrades or TURN. Review the account's current limits before deployment.

```sh
npm ci
npx wrangler login
npx wrangler d1 create x-focus-mode
```

Copy the returned database UUID into `wrangler.jsonc`, replacing only `database_id`. Then:

```sh
npx wrangler d1 execute x-focus-mode --remote --file=relay/schema.sql
npm run deploy
```

The Worker URL is the relay origin. Enter that HTTPS origin in the extension settings and grant access. `/health` reports protocol version. Test two installations before advertising the address. To make it the default in a fork, set `defaults.relay` in `shared/settings.ts`, update the in-product operator disclosure and privacy policy, rebuild and obtain fresh consent for changed data flows.

The configuration disables Workers observability and the application contains no request-body or credential logging. Cloudflare security/operational logs and abuse controls are separate. Do not claim that infrastructure sees no IPs. Do not turn on request-body logging in front of this service.

## Limits and costs

Current published Free plan limits include Workers 100,000 requests/day and 10 ms CPU per request; D1 500 MB/database, 5 million rows read/day and 100,000 rows written/day. SQLite Durable Objects are available on Free with their own request/duration/storage limits. These are account/platform limits, not guaranteed project capacity. Index updates count as writes. The coordinator adds internal requests. Check the live documentation:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

Reference application limits:

| Resource | Limit |
| --- | --- |
| Report lifetime | 30 days |
| Total stored reports, including withdrawals | 60,000 |
| Publishers per tweet | 16 |
| Maximum encoded report | 2,048 bytes |
| Batch lookup | 4 IDs / at most 64 reports |
| Incremental sync | 32 reports/page |
| Active coordinator sockets | 256 |
| Basic per-IP admission | 120 reads, 10 writes, 4 connections/minute |
| Scheduled expiry cleanup | 500 expired rows each 30 minutes |

The record ceiling conservatively aims below a 250 MB database budget including indexes, leaving headroom under the free 500 MB ceiling. This is a count-based guard, not a measured production byte guarantee. Watch actual D1 allocated storage, row reads/writes and Worker CPU in the account dashboard; reduce admission before the target is reached. Deletions may not immediately shrink allocated database files. Free-tier exhaustion produces unavailable responses; it must not trigger automatic upgrades.

Before a larger launch, measure CPU for signature verification, storage per row, peer hit rate, traffic including signalling, and quota consumption under real browsing. The current single coordinator and transient rate counters are preview limits, not a scalable global membership system. Split coordinators only when measurements justify it. A hostile relay or Sybil swarm can still degrade availability and report quality.

## Hostinger or another host

The report protocol is portable. This implementation's primary server uses Cloudflare-specific D1 and Durable Objects; ordinary shared PHP hosting cannot run it unchanged. A VPS could run a separate compatible HTTPS/WebSocket implementation, but that port is not included. No server is needed for provider-only or local-only classification.

## Rollback

Keep the previous Worker deployment and database backup. `wrangler rollback` restores Worker code; schema changes require a reviewed database migration. Version 1 uses one additive initial schema. Stop accepting new reports if capacity is reached; keep lookups and withdrawals available where possible. Never delete a live user's database to run tests: `npm run test:browser` is for the **local emulator only**.
