import {
  verifyReport,
  reportKey,
  supersedes,
  type Report,
  DAY,
} from "../shared/protocol.ts";
const MAX_CACHE = 20_000_000,
  DAILY = 10_000_000;
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("xfm-community-v1", 1);
    open.onupgradeneeded = () => {
      const records = open.result.createObjectStore("reports", {
        keyPath: "key",
      });
      records.createIndex("tweetId", "tweetId");
      records.createIndex("expiresAt", "expiresAt");
      open.result.createObjectStore("meta");
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  }));
}
function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}
export async function getReports(ids: string[]): Promise<Report[]> {
  const database = await db(),
    tx = database.transaction("reports", "readonly");
  const rows = await Promise.all(
    ids.map((id) =>
      request<any[]>(tx.objectStore("reports").index("tweetId").getAll(id, 32)),
    ),
  );
  return rows
    .flat()
    .map((r) => r.report as Report)
    .filter((r) => r.expiresAt > Date.now());
}
export async function putReports(values: unknown[]): Promise<number> {
  if (values.length > 64) throw new Error("Too many reports");
  const verified: Report[] = [];
  for (const value of values)
    try {
      verified.push(await verifyReport(value));
    } catch {
      /* Invalid peer data is never stored. */
    }
  const database = await db();
  let accepted = 0;
  for (const report of verified) {
    const tx = database.transaction(["reports", "meta"], "readwrite"),
      done = complete(tx),
      store = tx.objectStore("reports"),
      meta = tx.objectStore("meta");
    const key = reportKey(report);
    const [previous, total] = await Promise.all([
      request<any>(store.get(key)),
      request<number | undefined>(meta.get("bytes")),
    ]);
    const bytes = JSON.stringify(report).length * 2 + 256;
    if (
      supersedes(report, previous?.report) &&
      (total || 0) + bytes - (previous?.bytes || 0) <= MAX_CACHE
    ) {
      store.put({
        key,
        tweetId: report.tweetId,
        expiresAt: report.expiresAt,
        report,
        bytes,
      });
      meta.put((total || 0) + bytes - (previous?.bytes || 0), "bytes");
      accepted++;
    }
    await done;
  }
  return accepted;
}
export async function cleanReports() {
  const database = await db(),
    tx = database.transaction(["reports", "meta"], "readwrite"),
    done = complete(tx),
    store = tx.objectStore("reports"),
    meta = tx.objectStore("meta");
  let bytes = (await request<number | undefined>(meta.get("bytes"))) || 0;
  await new Promise<void>((resolve, reject) => {
    const req = store
      .index("expiresAt")
      .openCursor(IDBKeyRange.upperBound(Date.now()));
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const c = req.result;
      if (!c) {
        resolve();
        return;
      }
      bytes -= c.value.bytes;
      c.delete();
      c.continue();
    };
  });
  meta.put(Math.max(0, bytes), "bytes");
  await done;
}
export async function metadata<T>(key: string): Promise<T | undefined> {
  return request<T | undefined>(
    (await db()).transaction("meta", "readonly").objectStore("meta").get(key),
  );
}
export async function saveMetadata(key: string, value: unknown) {
  const tx = (await db()).transaction("meta", "readwrite");
  const done = complete(tx);
  tx.objectStore("meta").put(value, key);
  await done;
}
export async function reserveBudget(
  kind: "upload" | "download",
  bytes: number,
): Promise<boolean> {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > DAILY) return false;
  const tx = (await db()).transaction("meta", "readwrite"),
    done = complete(tx),
    store = tx.objectStore("meta"),
    key = "budget:" + kind;
  const old = await request<{ day: number; used: number } | undefined>(
    store.get(key),
  );
  const day = Math.floor(Date.now() / DAY),
    used = old?.day === day ? old.used : 0;
  const allowed = used + bytes <= DAILY;
  if (allowed) store.put({ day, used: used + bytes }, key);
  await done;
  return allowed;
}
export async function cacheStats() {
  return {
    bytes: (await metadata<number>("bytes")) || 0,
    upload: await metadata("budget:upload"),
    download: await metadata("budget:download"),
  };
}
export async function clearCommunity() {
  const tx = (await db()).transaction(["reports", "meta"], "readwrite");
  const done = complete(tx);
  tx.objectStore("reports").clear();
  tx.objectStore("meta").put(0, "bytes");
  await done;
}

export async function refundBudget(
  kind: "upload" | "download",
  bytes: number,
  day: number,
): Promise<void> {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > DAILY) return;
  const tx = (await db()).transaction("meta", "readwrite"),
    done = complete(tx),
    store = tx.objectStore("meta"),
    key = "budget:" + kind;
  const value = await request<{ day: number; used: number } | undefined>(
    store.get(key),
  );
  if (value?.day === day)
    store.put({ day, used: Math.max(0, value.used - bytes) }, key);
  await done;
}
