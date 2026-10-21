// Backfill: Jetstream only replays about three days, so records published before the index existed (or while it was
// down longer than that) are found the way AT Protocol's `tap` does it: ask a relay which repos hold the collection
// (com.atproto.sync.listReposByCollection), then read those records from each repo's own PDS. The work is a queue
// kept between runs, a few repos per cron tick, to stay inside Workers' per-invocation request limit.
import { LISTING_COLLECTION } from "./listing.ts";
import { NOTE_COLLECTION } from "./notes.ts";

export const COLLECTIONS = [LISTING_COLLECTION, NOTE_COLLECTION];
/** A full pass at most this often; Jetstream covers everything in between. */
export const FULL_PASS_EVERY = 6 * 3600;

export interface BackfillState {
  collection: number;           // index into COLLECTIONS being listed
  relayCursor?: string;         // listReposByCollection paging
  queue: string[];              // "collectionIndex|did" still to read
  lastFullAt: number;           // when the last complete pass finished
}

export interface BackfillDeps {
  relay: string;                                       // e.g. https://relay1.us-east.bsky.network
  fetchJSON(url: string): Promise<any>;                // throws or returns null on failure
  upsert(collection: string, did: string, rkey: string, record: any): Promise<void>;
  /** The repo's complete set of rkeys for the collection: anything else indexed from it is gone. */
  reconcile(collection: string, did: string, rkeys: string[]): Promise<void>;
  now: number;
  budget: number;                                      // outbound requests allowed this run
}

export const initialState = (): BackfillState => ({ collection: 0, queue: [], lastFullAt: 0 });

/** The PDS that hosts a DID's repo (did:plc via the PLC directory, did:web via its well-known document). */
export async function pdsFor(did: string, fetchJSON: BackfillDeps["fetchJSON"]): Promise<string | null> {
  let doc: any = null;
  if (did.startsWith("did:plc:")) doc = await fetchJSON(`https://plc.directory/${did}`);
  else if (did.startsWith("did:web:")) doc = await fetchJSON(`https://${did.slice(8).replaceAll(":", "/")}/.well-known/did.json`);
  const service = (doc?.service ?? []).find((s: any) => s?.id === "#atproto_pds" || s?.type === "AtprotoPersonalDataServer");
  const url = typeof service?.serviceEndpoint === "string" ? service.serviceEndpoint : null;
  return url && /^https:\/\//.test(url) ? url.replace(/\/$/, "") : null;
}

/** One run: list more repos if the queue is empty and a pass is due, then read as many queued repos as the budget allows. */
export async function backfillStep(s: BackfillState, d: BackfillDeps): Promise<{ state: BackfillState; read: number }> {
  const state: BackfillState = { ...s, queue: [...s.queue] };
  let budget = d.budget, read = 0;
  const passing = state.relayCursor !== undefined || state.collection > 0 || d.now - state.lastFullAt >= FULL_PASS_EVERY;
  if (state.queue.length === 0 && passing && budget > 0) {
    const c = COLLECTIONS[state.collection];
    budget--;
    const page = await d.fetchJSON(`${d.relay}/xrpc/com.atproto.sync.listReposByCollection?collection=${c}&limit=100${state.relayCursor ? `&cursor=${encodeURIComponent(state.relayCursor)}` : ""}`);
    if (page === null) return { state, read };  // relay unreachable: try again next tick, from the same place
    for (const r of page?.repos ?? []) if (typeof r?.did === "string") state.queue.push(`${state.collection}|${r.did}`);
    if (typeof page?.cursor === "string" && (page?.repos ?? []).length > 0) {
      state.relayCursor = page.cursor;
    } else {
      state.relayCursor = undefined;
      state.collection++;
      if (state.collection >= COLLECTIONS.length) { state.collection = 0; state.lastFullAt = d.now; }
    }
  }
  while (state.queue.length > 0 && budget >= 2) {
    const [ci, did] = state.queue[0].split("|");
    const collection = COLLECTIONS[Number(ci)];
    budget -= 2;
    const pds = await pdsFor(did, d.fetchJSON);
    const list = pds ? await d.fetchJSON(`${pds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${collection}&limit=100`) : null;
    state.queue.shift();
    if (!list) continue;
    const records: any[] = Array.isArray(list.records) ? list.records : [];
    const rkeys: string[] = [];
    for (const r of records) {
      const rkey = typeof r?.uri === "string" ? r.uri.split("/").pop() : null;
      if (!rkey) continue;
      rkeys.push(rkey);
      await d.upsert(collection, did, rkey, r.value);
    }
    // A complete listing (no further page) tells us what the repo no longer holds.
    if (!list.cursor || records.length < 100) await d.reconcile(collection, did, rkeys);
    read++;
  }
  return { state, read };
}
