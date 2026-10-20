import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { UPSERT } from "../relay/queries.ts";
const schema = readFileSync(
  new URL("../relay/schema.sql", import.meta.url),
  "utf8",
);
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  return db;
}
test("database atomically rejects stale revisions and discovers updates through new cursor", () => {
  const db = database(),
    put = db.prepare(UPSERT);
  assert.equal(put.run("publisher", "123", 2, 1, 100, 200, "first").changes, 1);
  const first = db.prepare("SELECT seq FROM reports").get()!.seq as number;
  assert.equal(
    put.run("publisher", "123", 2, 1, 100, 200, "replay").changes,
    0,
  );
  assert.equal(
    put.run("publisher", "123", 2, 2, 101, 199, "short tombstone").changes,
    0,
  );
  assert.equal(
    put.run("publisher", "123", 2, 2, 101, 201, "withdrawn").changes,
    1,
  );
  const row = db.prepare("SELECT seq,payload FROM reports").get()!;
  assert.ok(Number(row.seq) > first);
  assert.equal(row.payload, "withdrawn");
  assert.equal(db.prepare("SELECT records FROM capacity").get()!.records, 1);
  db.close();
});
test("per-tweet and total admission caps still allow corrections and expiry cleanup", () => {
  const db = database(),
    put = db.prepare(UPSERT);
  for (let i = 0; i < 16; i++) put.run("p" + i, "123", 2, 1, 100, 200, "{}");
  assert.throws(
    () => put.run("p17", "123", 2, 1, 100, 200, "{}"),
    /tweet_capacity/,
  );
  db.exec("UPDATE capacity SET records=60000");
  assert.throws(
    () => put.run("new", "456", 2, 1, 100, 200, "{}"),
    /relay_capacity/,
  );
  assert.equal(put.run("p1", "123", 2, 2, 101, 201, "withdrawn").changes, 1);
  db.exec("DELETE FROM reports WHERE publisher='p1'");
  assert.equal(
    db.prepare("SELECT records FROM capacity").get()!.records,
    59999,
  );
  db.close();
});
