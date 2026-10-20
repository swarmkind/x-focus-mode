import { bucketFor, tweetId, record } from "../shared/protocol.ts";
import {
  getReports,
  putReports,
  metadata,
  saveMetadata,
  reserveBudget,
  refundBudget,
  cleanReports,
  cacheStats,
} from "./store.ts";
let socket: WebSocket | undefined,
  relay = "",
  enabled = false,
  ownId = "",
  generation = 0,
  retries = 0;
let retry: ReturnType<typeof setTimeout> | undefined,
  syncTimer: ReturnType<typeof setTimeout> | undefined;
let buckets: number[] = [];
interface Peer {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  messages: number;
  window: number;
  timer: ReturnType<typeof setTimeout>;
  candidates: RTCIceCandidateInit[];
}
const peers = new Map<string, Peer>();
const pending = new Map<
  string,
  { resolve: () => void; timer: ReturnType<typeof setTimeout> }
>();
let transfers = 0,
  lastDrop = "";
function signal(data: unknown) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
}
function drop(id: string, reason = "closed") {
  lastDrop = reason;
  const p = peers.get(id);
  if (!p) return;
  peers.delete(id);
  clearTimeout(p.timer);
  p.dc?.close();
  p.pc.close();
  signal({ type: "capacity", slots: 4 - peers.size });
}
function stop() {
  enabled = false;
  generation++;
  clearTimeout(retry);
  clearTimeout(syncTimer);
  const ws = socket;
  socket = undefined;
  ws?.close();
  for (const id of peers.keys()) drop(id);
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.resolve();
  }
  pending.clear();
}
async function send(p: Peer, data: unknown) {
  const text = JSON.stringify(data);
  if (
    !enabled ||
    p.dc?.readyState !== "open" ||
    p.dc.bufferedAmount > 65536 ||
    !(await reserveBudget("upload", new TextEncoder().encode(text).length))
  )
    return;
  if (enabled && p.dc?.readyState === "open") {
    p.dc.send(text);
    transfers++;
  }
}
function channel(id: string, dc: RTCDataChannel) {
  const p = peers.get(id);
  if (!p) {
    dc.close();
    return;
  }
  if (p.dc) {
    dc.close();
    return;
  }
  p.dc = dc;
  dc.onopen = () => clearTimeout(p.timer);
  dc.onclose = () => drop(id, "data channel closed");
  dc.onmessage = async (event) => {
    if (
      !enabled ||
      typeof event.data !== "string" ||
      event.data.length > 100_000
    ) {
      drop(id);
      return;
    }
    const now = Date.now();
    if (now - p.window > 60_000) {
      p.window = now;
      p.messages = 0;
    }
    if (++p.messages > 60) {
      drop(id);
      return;
    }
    if (
      !(await reserveBudget(
        "download",
        new TextEncoder().encode(event.data).length,
      ))
    ) {
      drop(id);
      return;
    }
    try {
      const data: unknown = JSON.parse(event.data);
      if (
        !record(data) ||
        typeof data.request !== "string" ||
        !/^[-a-zA-Z0-9]{1,64}$/.test(data.request)
      )
        throw new Error("Invalid peer request");
      if (
        data.type === "get" &&
        Array.isArray(data.ids) &&
        data.ids.length <= 8 &&
        data.ids.every(tweetId)
      )
        await send(p, {
          type: "reports",
          request: data.request,
          reports: (await getReports(data.ids)).slice(0, 32),
        });
      else if (
        data.type === "reports" &&
        Array.isArray(data.reports) &&
        data.reports.length <= 32
      ) {
        if (!pending.has(data.request)) return;
        await putReports(data.reports);
        const request = pending.get(data.request);
        if (data.reports.length && request) {
          clearTimeout(request.timer);
          request.resolve();
          pending.delete(data.request);
        }
      } else throw new Error("Unknown peer message");
    } catch {
      drop(id, "invalid peer message");
    }
  };
}
async function connect(id: string, offer: boolean) {
  if (
    !enabled ||
    id === ownId ||
    peers.has(id) ||
    peers.size >= 4 ||
    !/^[-a-zA-Z0-9]{1,64}$/.test(id)
  )
    return;
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  });
  const p: Peer = {
    pc,
    messages: 0,
    window: Date.now(),
    timer: setTimeout(() => drop(id, "connection timeout"), 15_000),
    candidates: [],
  };
  peers.set(id, p);
  signal({ type: "capacity", slots: 4 - peers.size });
  pc.onicecandidate = (e) => {
    if (e.candidate)
      signal({ type: "signal", to: id, candidate: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(pc.connectionState))
      drop(id, "connection " + pc.connectionState);
  };
  pc.ondatachannel = (e) => channel(id, e.channel);
  if (offer) {
    channel(id, pc.createDataChannel("xfm-v1", { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    signal({ type: "signal", to: id, description: pc.localDescription });
  }
}
async function received(data: unknown) {
  if (!record(data) || !enabled) return;
  if (
    (data.type === "peers" ||
      (data.type === "welcome" && typeof data.id === "string")) &&
    Array.isArray(data.peers)
  ) {
    if (data.type === "welcome") {
      ownId = data.id as string;
      retries = 0;
    }
    signal({ type: "capacity", slots: 4 - peers.size });
    for (const p of data.peers.slice(0, 4))
      if (record(p) && typeof p.id === "string") await connect(p.id, true);
  } else if (data.type === "signal" && typeof data.from === "string") {
    const id = data.from;
    if (!peers.has(id)) await connect(id, false);
    const p = peers.get(id);
    if (!p) return;
    if (
      record(data.description) &&
      ["offer", "answer"].includes(data.description.type as string) &&
      typeof data.description.sdp === "string" &&
      data.description.sdp.length < 20_000
    ) {
      await p.pc.setRemoteDescription(
        data.description as unknown as RTCSessionDescriptionInit,
      );
      for (const c of p.candidates) await p.pc.addIceCandidate(c);
      p.candidates = [];
      if (data.description.type === "offer") {
        await p.pc.setLocalDescription(await p.pc.createAnswer());
        signal({ type: "signal", to: id, description: p.pc.localDescription });
      }
    } else if (record(data.candidate)) {
      if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.candidate);
      else if (p.candidates.length < 32) p.candidates.push(data.candidate);
    }
  }
}
function dial() {
  if (
    !enabled ||
    !navigator.onLine ||
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  )
    return;
  const url = new URL("/v1/peers", relay);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("buckets", buckets.join(","));
  const ws = new WebSocket(url);
  socket = ws;
  ws.onmessage = (e) => {
    if (ws !== socket || typeof e.data !== "string" || e.data.length > 30_000)
      return;
    try {
      void received(JSON.parse(e.data)).catch(() => {});
    } catch {
      ws.close();
    }
  };
  ws.onclose = () => {
    if (enabled && socket === ws) {
      socket = undefined;
      retry = setTimeout(
        dial,
        Math.min(60_000, 1000 * 2 ** Math.min(6, retries++)) +
          Math.random() * 1000,
      );
    }
  };
  ws.onerror = () => ws.close();
}
async function sync() {
  const run = generation;
  if (!enabled) return;
  if (peers.size < 4) signal({ type: "discover" });
  try {
    await cleanReports();
    for (const bucket of buckets) {
      if (!enabled || run !== generation) break;
      // Reserve the complete bounded response before requesting it; no quota overrun on a large response.
      const budgetDay = Math.floor(Date.now() / 86400000);
      if (!(await reserveBudget("download", 65536))) break;
      const cursor =
        (await metadata<number>("cursor:" + relay + ":" + bucket)) || 0;
      const response = await fetch(new URL("/v1/sync", relay), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, cursor }),
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (
        !response.ok ||
        Number(response.headers.get("content-length")) > 65536
      )
        continue;
      const reader = response.body!.getReader();
      let text = "",
        size = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const c = await reader.read();
          if (c.done) break;
          size += c.value.length;
          if (size > 65536) throw new Error("Sync response too large");
          text += decoder.decode(c.value, { stream: true });
        }
      } finally {
        await reader.cancel();
        await refundBudget("download", Math.max(0, 65536 - size), budgetDay);
      }
      if (!enabled || run !== generation) break;
      const data = JSON.parse(text);
      if (
        !record(data) ||
        !Array.isArray(data.reports) ||
        data.reports.length > 32 ||
        !Number.isSafeInteger(data.cursor) ||
        Number(data.cursor) < cursor
      )
        continue;
      const valid = [];
      for (const r of data.reports)
        if (
          record(r) &&
          tweetId(r.tweetId) &&
          (await bucketFor(r.tweetId)) === bucket
        )
          valid.push(r);
      await putReports(valid);
      await saveMetadata("cursor:" + relay + ":" + bucket, data.cursor);
    }
  } catch {
    /* Offline, quota and relay failure leave personal filtering available. */
  }
  if (enabled && run === generation)
    syncTimer = setTimeout(() => void sync(), 5 * 60_000);
}
async function configure(url: string) {
  if (enabled && url === relay) {
    if (!socket && buckets.length === 2) dial();
    return;
  }
  stop();
  relay = url;
  buckets = [];
  const configuring = generation;
  if (!url) return;
  enabled = true;
  buckets = (await metadata<number[]>("buckets")) || [];
  if (buckets.length !== 2) {
    const a = crypto.getRandomValues(new Uint8Array(2));
    buckets = [a[0] % 64, ((a[0] % 64) + 1 + (a[1] % 63)) % 64];
    await saveMetadata("buckets", buckets);
  }
  if (!enabled || configuring !== generation) return;
  dial();
  void sync();
}
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    (sender.url && sender.url !== chrome.runtime.getURL("worker.js")) ||
    msg?.target !== "offscreen"
  )
    return;
  (async () => {
    if (msg.type === "stop") {
      stop();
      return { stopped: true };
    }
    if (msg.type === "configure" && typeof msg.relay === "string") {
      await configure(msg.relay);
      return { enabled };
    }
    if (msg.type === "status")
      return {
        peers: [...peers.values()].filter((p) => p.dc?.readyState === "open")
          .length,
        enabled,
        buckets,
        transfers,
        lastDrop,
        ...(await cacheStats()),
      };
    if (
      msg.type === "lookup" &&
      enabled &&
      Array.isArray(msg.ids) &&
      msg.ids.length <= 8 &&
      msg.ids.every(tweetId)
    ) {
      const request = crypto.randomUUID();
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(request);
          resolve();
        }, 290);
        pending.set(request, { resolve, timer });
        for (const p of peers.values())
          void send(p, { type: "get", request, ids: msg.ids });
      });
      return { reports: await getReports(msg.ids) };
    }
    return {};
  })().then(respond, () =>
    respond({ error: "Community distribution unavailable" }),
  );
  return true;
});
window.addEventListener("offline", () => {
  socket?.close();
  for (const id of peers.keys()) drop(id);
});
window.addEventListener("online", () => {
  if (enabled) {
    clearTimeout(retry);
    dial();
  }
});
void chrome.runtime.sendMessage({ type: "network-config" }).then((c) => {
  if (c?.enabled && c.relay) void configure(c.relay);
});
