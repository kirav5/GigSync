// Public notes and backfill, on Node's built-in SQLite (same SQL and FTS5 as D1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { countNotes, ftsQuery, MAX_NOTES_PER_REPO, noteFor, putNote, removeNote, searchNotes } from "../src/notes.ts";
import { backfillStep, COLLECTIONS, initialState, pdsFor } from "../src/backfill.ts";
import { count, ingest, removeRecord, type DB } from "../src/store.ts";

function memoryDB(): DB {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  return { prepare(sql: string) { const st = db.prepare(sql); return { bind: (...a: unknown[]) => ({
    all: async () => ({ results: st.all(...(a as any[])) as any[] }), run: async () => st.run(...(a as any[])), first: async () => st.get(...(a as any[])) ?? null }) }; } };
}
const now = Math.floor(Date.now() / 1000);
const riya = "did:plc:riya000000000000000000aa", sam = "did:plc:sam0000000000000000000000a";
const rec = (text: string, at = "2026-10-08T10:00:00Z") => ({ $type: "dev.collab.world.note", text, createdAt: at });

test("public notes are found by their words, in any language, best match first", async () => {
  const db = memoryDB();
  await putNote(db, noteFor(riya, "a", rec("I teach pottery on Sundays in Indiranagar"))!, now);
  await putNote(db, noteFor(sam, "b", rec("Selling homemade mango pickle, Koramangala"))!, now);
  await putNote(db, noteFor(sam, "c", rec("मैं रविवार को योग सिखाता हूँ"))!, now);
  assert.deepEqual((await searchNotes(db, "pottery")).map(n => n.did), [riya]);
  assert.deepEqual((await searchNotes(db, "Pottery Sundays")).map(n => n.rkey), ["a"]);   // every word, any case
  assert.deepEqual((await searchNotes(db, "pott")).map(n => n.rkey), ["a"]);              // prefixes
  assert.deepEqual((await searchNotes(db, "योग")).map(n => n.rkey), ["c"]);                // Hindi
  assert.deepEqual(await searchNotes(db, "pottery", { did: sam }), []);
  // No note has every word: the ones with any of them, best first.
  assert.deepEqual((await searchNotes(db, "teach pottery yoga")).map(n => n.rkey), ["a"]);
  assert.deepEqual((await searchNotes(db, "mango cricket")).map(n => n.rkey), ["b"]);                   // one person's notes
  assert.deepEqual(await searchNotes(db, "\" OR 1=1 --"), []);                            // FTS syntax can't be injected
  assert.equal(ftsQuery("NEAR(a b) * ^"), "\"near\"*");                                 // operators become plain words
  assert.equal(ftsQuery("* ^ -"), null);
});

test("deleting a note removes it from search; a malformed record is refused", async () => {
  const db = memoryDB();
  await putNote(db, noteFor(riya, "a", rec("I teach pottery"))!, now);
  await removeNote(db, riya, "a");
  assert.deepEqual(await searchNotes(db, "pottery"), []);
  assert.equal(noteFor(riya, "x", { text: "", createdAt: "2026-10-08T10:00:00Z" }), null);
  assert.equal(noteFor(riya, "x", { text: "x".repeat(1001), createdAt: "2026-10-08T10:00:00Z" }), null);
  assert.equal(noteFor(riya, "x", { $type: "app.bsky.feed.post", text: "hi", createdAt: "2026-10-08T10:00:00Z" }), null);
  assert.equal(noteFor("not a did", "x", rec("hi")), null);
});

test("one repo can't flood the index: only its newest notes are kept", async () => {
  const db = memoryDB();
  for (let i = 0; i < MAX_NOTES_PER_REPO + 5; i++) {
    await putNote(db, noteFor(riya, `r${i}`, rec(`note number ${i} about bikes`, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()))!, now);
  }
  assert.equal(await countNotes(db), MAX_NOTES_PER_REPO);
  assert.equal((await searchNotes(db, "bikes", { limit: 50 })).some(n => n.rkey === "r0"), false);
});

test("backfill finds records published before the index existed, and forgets ones since deleted", async () => {
  const db = memoryDB();
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/listing.json", import.meta.url), "utf8"));
  const pds = "https://pds.example";
  let repoNotes: any[] = [{ uri: `at://${riya}/dev.collab.world.note/n1`, value: rec("I fix bicycles on weekends") }];
  const relay = "https://relay.example";
  let requests = 0;
  const fetchJSON = async (u: string) => {
    requests++;
    if (u.startsWith(`${relay}/xrpc/com.atproto.sync.listReposByCollection`)) {
      const c = new URL(u).searchParams.get("collection");
      return c === COLLECTIONS[0] ? { repos: [{ did: sam }] } : { repos: [{ did: riya }] };
    }
    if (u.startsWith("https://plc.directory/")) return { service: [{ id: "#atproto_pds", type: "AtprotoPersonalDataServer", serviceEndpoint: pds }] };
    if (u.includes("listRecords") && u.includes(encodeURIComponent(sam))) return { records: [{ uri: `at://${sam}/dev.collab.market.listing/l1`, value: { event: fixture.active } }] };
    if (u.includes("listRecords") && u.includes(encodeURIComponent(riya))) return { records: repoNotes };
    return null;
  };
  const deps = (t: number) => ({
    relay, fetchJSON, now: t, budget: 40,
    upsert: async (c: string, did: string, rkey: string, value: any) => {
      if (c === COLLECTIONS[1]) { const n = noteFor(did, rkey, value); if (n) await putNote(db, n, t); } else await ingest(db, value.event, t, { did, rkey });
    },
    reconcile: async (c: string, did: string, rkeys: string[]) => {
      const table = c === COLLECTIONS[1] ? "notes" : "listings";
      const held = (await db.prepare(`SELECT rkey FROM ${table} WHERE did = ?`).bind(did).all()).results as any[];
      for (const h of held) if (!rkeys.includes(h.rkey)) { if (table === "notes") await removeNote(db, did, h.rkey); else await removeRecord(db, did, h.rkey); }
    },
  });
  let s = initialState();
  for (let i = 0; i < 6; i++) s = (await backfillStep(s, deps(now))).state;   // listings page, repos, notes page, repos
  assert.equal(await count(db, now), 1);
  assert.deepEqual((await searchNotes(db, "bicycles")).map(n => n.did), [riya]);
  assert.equal(s.lastFullAt, now);
  // Nothing more until the next pass is due.
  const before = requests;
  s = (await backfillStep(s, deps(now + 60))).state;
  assert.equal(requests, before);
  // Six hours later: Riya deleted her note; the next pass forgets it.
  repoNotes = [];
  for (let i = 0; i < 6; i++) s = (await backfillStep(s, deps(now + 7 * 3600))).state;
  assert.deepEqual(await searchNotes(db, "bicycles"), []);
  // The budget is respected: never more requests than allowed in one run.
  s = { ...initialState(), queue: Array.from({ length: 50 }, (_, i) => `1|did:plc:x${i}`) };
  const start = requests;
  await backfillStep(s, { ...deps(now), budget: 10 });
  assert.ok(requests - start <= 10);
});

test("a repo's PDS comes from its DID document; anything but https is refused", async () => {
  const doc = (endpoint: string) => async () => ({ service: [{ id: "#atproto_pds", serviceEndpoint: endpoint }] });
  assert.equal(await pdsFor("did:plc:abc", doc("https://pds.example/")), "https://pds.example");
  assert.equal(await pdsFor("did:plc:abc", doc("http://evil.example")), null);
  assert.equal(await pdsFor("did:key:abc", doc("https://pds.example")), null);
});
