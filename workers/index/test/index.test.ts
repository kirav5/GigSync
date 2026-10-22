// The index's logic against a real listing signed by the Collab app, on Node's built-in SQLite (same SQL as D1).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import {
  asNostrEvent,
  fromJetstream,
  isAuthentic,
  matches,
  type NostrEvent,
  normalizeFilter,
  type Row,
  rowFor,
  sqlFor,
} from "../src/listing.ts";
import { count, ingest, query, removeRecord } from "../src/store.ts";
import { memoryDB, must } from "./db.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/listing.json", import.meta.url), "utf8"));
const active: NostrEvent = fixture.active,
  sold: NostrEvent = fixture.sold;
const now = Math.floor(Date.now() / 1000);

/** A signed event with changed fields (a different seller key), to test replacement and forgery. */
function resign(e: NostrEvent, change: (e: NostrEvent) => void, key = schnorr.utils.randomPrivateKey()): NostrEvent {
  const c: NostrEvent = JSON.parse(JSON.stringify(e));
  change(c);
  c.pubkey = bytesToHex(schnorr.getPublicKey(key));
  c.id = bytesToHex(
    sha256(new TextEncoder().encode(JSON.stringify([0, c.pubkey, c.created_at, c.kind, c.tags, c.content]))),
  );
  c.sig = bytesToHex(schnorr.sign(c.id, key));
  return c;
}

test("the app's signed listing verifies; any edit doesn't", () => {
  assert.ok(isAuthentic(active));
  const edited = { ...active, content: `${active.content} (cheaper!)` };
  assert.equal(isAuthentic(edited), false);
  assert.equal(rowFor(edited, now), null);
  const row = rowFor(active, now);
  assert.ok(row && row !== "remove" && row.category === "collab-property-sale" && row.g4 === "tdr1");
});

test("search by category and area at any precision; other areas and categories don't match", async () => {
  const db = memoryDB();
  assert.ok(await ingest(db, active, now));
  const g = active.tags.filter((t) => t[0] === "g").map((t) => t[1]);
  for (const cell of g) {
    const found = await query(db, { kinds: [30402], tags: { t: ["collab-property-sale"], g: [cell] } }, now);
    assert.equal(found.length, 1, `cell ${cell}`);
    assert.equal(found[0].id, active.id);
  }
  assert.equal((await query(db, { kinds: [30402], tags: { t: ["collab-property-rent"], g: [g[0]] } }, now)).length, 0);
  assert.equal(
    (await query(db, { kinds: [30402], tags: { t: ["collab-property-sale"], g: ["u4pr"] } }, now)).length,
    0,
  );
  assert.equal(await count(db, now), 1);
});

test("price bounds filter listings; a listing with no price still matches", async () => {
  const db = memoryDB();
  await ingest(db, active, now); // fixture asks ₹80,00,000
  const priceless = resign(active, (e) => {
    e.tags = e.tags.filter((t) => t[0] !== "price");
  });
  await ingest(db, priceless, now);
  const f = (extra: object) => ({ kinds: [30402], tags: { t: ["collab-property-sale"] }, ...extra });
  assert.equal((await query(db, f({ maxPrice: 90_000_00 }), now)).length, 2);
  assert.equal((await query(db, f({ maxPrice: 70_000_00 }), now)).length, 1);
  assert.equal((await query(db, f({ minPrice: 90_000_00 }), now)).length, 1);
  assert.equal((await query(db, f({ minPrice: 70_000_00 }), now)).length, 2);
  // The same bounds apply to live pushes; garbage values filter nothing.
  const row = (e: NostrEvent) => rowFor(e, now) as Row;
  assert.equal(matches(f({ maxPrice: 70_000_00 }), row(active)), false);
  assert.equal(matches(f({ maxPrice: 70_000_00 }), row(priceless)), true);
  assert.equal((await query(db, f({ maxPrice: "lots" }), now)).length, 2);
});

test("a newer version replaces; marking it sold removes it; an older copy can't bring it back", async () => {
  const db = memoryDB();
  await ingest(db, active, now);
  await ingest(db, sold, now);
  assert.ok(sold.created_at > active.created_at);
  assert.equal(await count(db, now), 0);
  assert.equal(await ingest(db, active, now), null);
});

test("Jetstream: a create indexes the listing under its repo; a delete removes it", async () => {
  const db = memoryDB();
  const create = {
    did: "did:plc:asha",
    time_us: 1,
    kind: "commit",
    commit: {
      operation: "create",
      collection: "dev.collab.market.listing",
      rkey: "01OFFER",
      record: { event: active },
    },
  };
  const c = fromJetstream(create);
  assert.ok(c && c.op === "upsert");
  await ingest(db, c.event, now, { did: "did:plc:asha", rkey: "01OFFER" });
  assert.equal(await count(db, now), 1);
  const del = fromJetstream({ ...create, commit: { ...create.commit, operation: "delete", record: undefined } });
  assert.ok(del && del.op === "delete");
  await removeRecord(db, "did:plc:asha", "01OFFER");
  assert.equal(await count(db, now), 0);
  assert.equal(fromJetstream({ kind: "commit", commit: { collection: "app.bsky.feed.post" } }), null);
});

test("open searches get only matching new listings", () => {
  const row = rowFor(active, now);
  assert.ok(row && row !== "remove");
  assert.ok(matches({ kinds: [30402], tags: { t: ["collab-property-sale"], g: [row.g5] } }, row));
  assert.equal(matches({ kinds: [30402], tags: { t: ["collab-wholesale"] } }, row), false);
  assert.equal(matches({ kinds: [30402], tags: { g: ["u4pr"] } }, row), false);
});

test("filters become bounded, parameterised SQL", () => {
  const { sql, args } = sqlFor(
    {
      kinds: [30402],
      tags: { t: ["collab-property-sale", "x'); DROP TABLE listings;--"], g: ["tdr1", "tdr1w"] },
      limit: 10_000,
    },
    now,
  );
  assert.ok(sql.includes("LIMIT 500") && !sql.includes("DROP"));
  assert.deepEqual(args.slice(0, 2), [now, "collab-property-sale"]);
  // A forged listing by someone else's key for the same id is a different key; it never replaces the original.
  const forged = resign(active, (e) => {
    e.content = "scam";
  });
  const r = rowFor(forged, now);
  assert.ok(r && r !== "remove" && r.key !== `${active.pubkey}|${must(active.tags.find((t) => t[0] === "d"))[1]}`);
});

test("both filter spellings search the same way; neither means everything", () => {
  const app = normalizeFilter({ kinds: [30402], tags: { t: ["collab-electronics"] } });
  const nostr = normalizeFilter({ kinds: [30402], "#t": ["collab-electronics"] });
  assert.deepEqual(app?.tags, nostr?.tags);
  assert.match(sqlFor(must(nostr), 0).sql, /category IN/);
  assert.equal(normalizeFilter(null), null);
});

test("outside input is checked field by field before it is used", () => {
  assert.deepEqual(asNostrEvent(active), active);
  assert.equal(asNostrEvent({ ...active, tags: "nope" }), null);
  assert.equal(asNostrEvent({ ...active, created_at: "yesterday" }), null);
  assert.equal(asNostrEvent(null), null);
  assert.equal(normalizeFilter({ tags: { t: ["collab-electronics"] } }), null); // no kinds: not a search
  assert.deepEqual(normalizeFilter({ kinds: [30402, "x"], authors: "me", limit: Number.NaN })?.kinds, [30402]);
});
