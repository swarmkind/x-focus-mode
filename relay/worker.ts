import { UPSERT } from "./queries.ts";
import { DurableObject } from "cloudflare:workers";
import {
  verifyReport,
  bucketFor,
  record,
  tweetId,
  MAX_REPORT_BYTES,
} from "../shared/protocol.ts";
interface Env {
  DB: D1Database;
  COORDINATOR: DurableObjectNamespace<Coordinator>;
}
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}
async function read(request: Request, max: number): Promise<unknown> {
  if (
    Number(request.headers.get("Content-Length")) > max ||
    !request.headers.get("Content-Type")?.startsWith("application/json")
  )
    throw new Error("Invalid body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > max) throw new Error("Body too large");
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel();
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method === "GET" && path === "/health")
      return json({ protocol: 1, status: "ok", retentionDays: 30 });
    const coordinator = env.COORDINATOR.get(
      env.COORDINATOR.idFromName("network-v1"),
    );
    if (request.method === "GET" && path === "/v1/peers")
      return coordinator.fetch(request);
    if (
      request.method !== "POST" ||
      !["/v1/report", "/v1/lookup", "/v1/sync"].includes(path)
    )
      return json({ error: "Not found" }, 404);
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const gate = await coordinator.fetch(
      new Request("https://internal/admit", {
        method: "POST",
        headers: {
          "X-Client": ip,
          "X-Kind": path === "/v1/report" ? "write" : "read",
        },
      }),
    );
    if (!gate.ok) return json({ error: "Rate limit; retry later" }, 429);
    try {
      if (path === "/v1/report") {
        const r = await verifyReport(await read(request, MAX_REPORT_BYTES));
        const bucket = await bucketFor(r.tweetId);
        // Revisions update atomically. A new sequence makes corrections discoverable by incremental sync.
        const result = await env.DB.prepare(UPSERT)
          .bind(
            r.publisher,
            r.tweetId,
            bucket,
            r.revision,
            r.issuedAt,
            r.expiresAt,
            JSON.stringify(r),
          )
          .run();
        if (!result.meta.changes)
          return json({ error: "Duplicate or stale revision" }, 409);
        return json({ accepted: true });
      }
      const data = await read(request, 1024);
      if (!record(data)) throw new Error("Invalid query");
      if (path === "/v1/lookup") {
        if (
          Object.keys(data).length !== 1 ||
          !Array.isArray(data.ids) ||
          data.ids.length < 1 ||
          data.ids.length > 4 ||
          !data.ids.every(tweetId)
        )
          throw new Error("Invalid IDs");
        const rows = await env.DB.prepare(
          `SELECT payload FROM reports WHERE tweet_id IN (${data.ids.map(() => "?").join(",")}) AND expires_at>? LIMIT 64`,
        )
          .bind(...data.ids, Date.now())
          .all<{ payload: string }>();
        return json({
          reports: rows.results.map((r) => JSON.parse(r.payload)),
        });
      }
      if (
        Object.keys(data).length !== 2 ||
        !Number.isInteger(data.bucket) ||
        Number(data.bucket) < 0 ||
        Number(data.bucket) >= 64 ||
        !Number.isSafeInteger(data.cursor) ||
        Number(data.cursor) < 0
      )
        throw new Error("Invalid sync cursor");
      const rows = await env.DB.prepare(
        "SELECT seq,payload FROM reports WHERE bucket=? AND seq>? AND expires_at>? ORDER BY seq LIMIT 32",
      )
        .bind(data.bucket, data.cursor, Date.now())
        .all<{ seq: number; payload: string }>();
      return json({
        reports: rows.results.map((r) => JSON.parse(r.payload)),
        cursor: rows.results.at(-1)?.seq || data.cursor,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/capacity|D1_|quota|limit|SQLITE_FULL/i.test(message))
        return json({ error: "Relay capacity unavailable" }, 503);
      return json({ error: "Invalid request or report" }, 400);
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      env.DB.prepare(
        "DELETE FROM reports WHERE seq IN (SELECT seq FROM reports WHERE expires_at<=? LIMIT 500)",
      )
        .bind(Date.now())
        .run(),
    );
  },
};
type Attachment = {
  id: string;
  buckets: number[];
  slots: number;
  window: number;
  messages: number;
};
export class Coordinator extends DurableObject<Env> {
  rates = new Map<
    string,
    { minute: number; reads: number; writes: number; connections: number }
  >();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }
  availablePeers(id: string, buckets: number[]) {
    return this.ctx
      .getWebSockets()
      .map((ws) => ws.deserializeAttachment() as Attachment)
      .filter((a) => a?.id && a.id !== id && a.slots > 0)
      .map((a) => ({ ...a, rank: Math.random() }))
      .sort(
        (a, b) =>
          Number(b.buckets.some((x) => buckets.includes(x))) -
            Number(a.buckets.some((x) => buckets.includes(x))) ||
          a.rank - b.rank,
      )
      .slice(0, 4)
      .map((p) => ({ id: p.id, buckets: p.buckets }));
  }
  admit(ip: string, kind: "read" | "write" | "connection") {
    const minute = Math.floor(Date.now() / 60_000);
    let count = this.rates.get(ip);
    if (!count || count.minute !== minute) {
      count = { minute, reads: 0, writes: 0, connections: 0 };
      this.rates.set(ip, count);
    }
    if (this.rates.size > 10_000)
      for (const [key, value] of this.rates)
        if (value.minute !== minute) this.rates.delete(key);
    if (this.rates.size > 10_000) return false;
    return kind === "write"
      ? ++count.writes <= 10
      : kind === "connection"
        ? ++count.connections <= 4
        : ++count.reads <= 120;
  }
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/admit")
      return new Response(null, {
        status: this.admit(
          request.headers.get("X-Client") || "",
          request.headers.get("X-Kind") === "write" ? "write" : "read",
        )
          ? 204
          : 429,
      });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("WebSocket required", { status: 426 });
    if (
      !this.admit(
        request.headers.get("CF-Connecting-IP") || "local",
        "connection",
      ) ||
      this.ctx.getWebSockets().length >= 256
    )
      return new Response("Connection capacity", { status: 429 });
    const buckets = (url.searchParams.get("buckets") || "")
      .split(",")
      .map(Number);
    if (
      buckets.length !== 2 ||
      new Set(buckets).size !== 2 ||
      !buckets.every((x) => Number.isInteger(x) && x >= 0 && x < 64)
    )
      return new Response("Invalid buckets", { status: 400 });
    const pair = new WebSocketPair(),
      client = pair[0],
      server = pair[1],
      id = crypto.randomUUID();
    const peers = this.availablePeers(id, buckets);
    const attachment: Attachment = {
      id,
      buckets,
      slots: 4,
      window: Date.now(),
      messages: 0,
    };
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment(attachment);
    server.send(
      JSON.stringify({
        type: "welcome",
        id,
        peers,
      }),
    );
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const a = ws.deserializeAttachment() as Attachment;
    if (typeof message !== "string" || message.length > 30_000) {
      ws.close(1009, "Message too large");
      return;
    }
    if (Date.now() - a.window > 60_000) {
      a.window = Date.now();
      a.messages = 0;
    }
    if (++a.messages > 100) {
      ws.close(1008, "Rate limit");
      return;
    }
    ws.serializeAttachment(a);
    try {
      const data = JSON.parse(message);
      if (
        record(data) &&
        data.type === "capacity" &&
        Number.isInteger(data.slots) &&
        Number(data.slots) >= 0 &&
        Number(data.slots) <= 4
      ) {
        a.slots = Number(data.slots);
        ws.serializeAttachment(a);
        return;
      }
      if (record(data) && data.type === "discover") {
        ws.send(
          JSON.stringify({
            type: "peers",
            peers: this.availablePeers(a.id, a.buckets),
          }),
        );
        return;
      }
      if (
        !record(data) ||
        data.type !== "signal" ||
        typeof data.to !== "string" ||
        data.to.length > 64
      )
        throw new Error("Invalid signal");
      const target = this.ctx.getWebSockets(data.to)[0];
      if (!target || target === ws) return;
      const outgoing: Record<string, unknown> = { type: "signal", from: a.id };
      if (
        record(data.description) &&
        ["offer", "answer"].includes(data.description.type as string) &&
        typeof data.description.sdp === "string" &&
        data.description.sdp.length < 20_000
      )
        outgoing.description = {
          type: data.description.type,
          sdp: data.description.sdp,
        };
      else if (
        record(data.candidate) &&
        typeof data.candidate.candidate === "string" &&
        data.candidate.candidate.length < 2048
      )
        outgoing.candidate = {
          candidate: data.candidate.candidate,
          sdpMid:
            typeof data.candidate.sdpMid === "string"
              ? data.candidate.sdpMid.slice(0, 64)
              : null,
          sdpMLineIndex: Number.isInteger(data.candidate.sdpMLineIndex)
            ? data.candidate.sdpMLineIndex
            : null,
        };
      else throw new Error("Invalid payload");
      target.send(JSON.stringify(outgoing));
    } catch {
      ws.close(1008, "Invalid signal");
    }
  }
  webSocketClose(ws: WebSocket, code: number) {
    ws.close(code === 1006 ? 1000 : code);
  }
  webSocketError(ws: WebSocket) {
    ws.close(1011, "Connection error");
  }
}
