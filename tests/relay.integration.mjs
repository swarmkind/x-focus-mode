import assert from "node:assert/strict";
import {
  createIdentity,
  signReport,
  bucketFor,
  RETENTION,
} from "../shared/protocol.ts";
const identity = await createIdentity(),
  now = Date.now(),
  id = String(now) + "001";
const base = {
  v: 1,
  tweetId: id,
  categories: ["ragebait"],
  source: "human",
  model: "",
  publisher: identity.publicKey,
  revision: 1,
  issuedAt: now,
  expiresAt: now + RETENTION,
  withdrawn: false,
};
const report = await signReport(base, identity.privateKey);
async function post(path, body) {
  return fetch("http://127.0.0.1:8787" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
assert.equal((await post("/v1/report", report)).status, 200);
assert.equal((await post("/v1/report", report)).status, 409);
assert.equal(
  (await post("/v1/report", { ...report, categories: ["doomering"] })).status,
  400,
);
assert.equal(
  (await post("/v1/report", { ...report, text: "must not persist" })).status,
  400,
);
const first = await (
  await post("/v1/sync", { bucket: await bucketFor(id), cursor: 0 })
).json();
assert.ok(first.reports.some((r) => r.tweetId === id));
const withdrawal = await signReport(
  {
    ...base,
    categories: [],
    withdrawn: true,
    revision: 2,
    issuedAt: now + 1,
    expiresAt: now + 1 + RETENTION,
  },
  identity.privateKey,
);
assert.equal((await post("/v1/report", withdrawal)).status, 200);
const lookup = await (await post("/v1/lookup", { ids: [id] })).json();
assert.equal(lookup.reports.length, 1);
assert.equal(lookup.reports[0].withdrawn, true);
const updated = await (
  await post("/v1/sync", { bucket: await bucketFor(id), cursor: first.cursor })
).json();
assert.ok(updated.reports.some((r) => r.withdrawn));
assert.equal(
  (await post("/v1/lookup", { ids: Array(5).fill(id) })).status,
  400,
);
console.log(
  "PASS live local Worker/D1: signature, replay, strict schema, withdrawal and incremental sync",
);
const sockets = [];
function next(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Coordinator response timeout")),
      3000,
    );
    socket.addEventListener(
      "message",
      (e) => {
        clearTimeout(timer);
        resolve(JSON.parse(e.data));
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("Coordinator socket failed"));
      },
      { once: true },
    );
  });
}
async function join() {
  const socket = new WebSocket("ws://127.0.0.1:8787/v1/peers?buckets=1,2");
  sockets.push(socket);
  return { socket, welcome: await next(socket) };
}
try {
  const a = await join();
  a.socket.send(JSON.stringify({ type: "capacity", slots: 0 }));
  const ack = next(a.socket);
  a.socket.send(JSON.stringify({ type: "discover" }));
  await ack;
  const b = await join();
  assert.ok(!b.welcome.peers.some((p) => p.id === a.welcome.id));
  a.socket.send(JSON.stringify({ type: "capacity", slots: 1 }));
  const barrier = next(a.socket);
  a.socket.send(JSON.stringify({ type: "discover" }));
  await barrier;
  const discovered = next(b.socket);
  b.socket.send(JSON.stringify({ type: "discover" }));
  assert.ok((await discovered).peers.some((p) => p.id === a.welcome.id));
  console.log(
    "PASS coordinator capacity and rediscovery after a peer frees a slot",
  );
} finally {
  for (const socket of sockets) socket.close();
}
