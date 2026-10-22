// Backfill: Jetstream only replays about three days, so records published before the index existed (or while it was
// down longer than that) are found the way AT Protocol's `tap` does it: ask a relay which repos hold the collection
// (com.atproto.sync.listReposByCollection), then read those records from each repo's own PDS. The work is a queue
// kept between runs, a few repos per cron tick, to stay inside Workers' per-invocation request limit.
import { KEY_SEPARATOR, PDS_SERVICE_ID, PDS_SERVICE_TYPE } from "./constants.ts";
import { arr, isObject, obj, str } from "./json.ts";
import { LISTING_COLLECTION } from "./listing.ts";
import { NOTE_COLLECTION } from "./notes.ts";

export const COLLECTIONS = [LISTING_COLLECTION, NOTE_COLLECTION];
/** A full pass at most this often; Jetstream covers everything in between. */
export const FULL_PASS_EVERY = 6 * 3600;
/** Records or repos per XRPC page. A shorter page means the list is complete. */
const PAGE_SIZE = 100;
/** Outbound requests to read one repo: resolve its PDS, then list its records. */
const REQUESTS_PER_REPO = 2;
const PLC_DIRECTORY = "https://plc.directory";
const DID_PLC = "did:plc:";
const DID_WEB = "did:web:";

export interface BackfillState {
  collection: number; // index into COLLECTIONS being listed
  relayCursor?: string | undefined; // listReposByCollection paging
  queue: string[]; // "collectionIndex|did" still to read
  lastFullAt: number; // when the last complete pass finished
}

export interface BackfillDeps {
  relay: string; // e.g. https://relay1.us-east.bsky.network
  fetchJSON(url: string): Promise<unknown>; // null on failure
  upsert(collection: string, did: string, rkey: string, record: unknown): Promise<void>;
  /** The repo's complete set of rkeys for the collection: anything else indexed from it is gone. */
  reconcile(collection: string, did: string, rkeys: string[]): Promise<void>;
  now: number;
  budget: number; // outbound requests allowed this run
}

export const initialState = (): BackfillState => ({ collection: 0, queue: [], lastFullAt: 0 });

/** Where a DID's document lives: the PLC directory for did:plc, the domain's well-known file for did:web. */
function didDocumentUrl(did: string): string | null {
  if (did.startsWith(DID_PLC)) return `${PLC_DIRECTORY}/${did}`;
  if (did.startsWith(DID_WEB)) return `https://${did.slice(DID_WEB.length).replaceAll(":", "/")}/.well-known/did.json`;
  return null;
}

/** The PDS that hosts a DID's repo (did:plc via the PLC directory, did:web via its well-known document). */
export async function pdsFor(did: string, fetchJSON: BackfillDeps["fetchJSON"]): Promise<string | null> {
  const docUrl = didDocumentUrl(did);
  const doc = docUrl ? obj(await fetchJSON(docUrl)) : undefined;
  const service = arr(doc?.service)
    .filter(isObject)
    .find((s) => s.id === PDS_SERVICE_ID || s.type === PDS_SERVICE_TYPE);
  const url = str(service?.serviceEndpoint);
  return url && /^https:\/\//.test(url) ? url.replace(/\/$/, "") : null;
}

/** Lists the next page of repos holding the current collection and queues them. Returns false if the relay failed. */
async function listRepos(state: BackfillState, d: BackfillDeps): Promise<boolean> {
  const c = COLLECTIONS[state.collection];
  const cursor = state.relayCursor ? `&cursor=${encodeURIComponent(state.relayCursor)}` : "";
  const page = obj(
    await d.fetchJSON(
      `${d.relay}/xrpc/com.atproto.sync.listReposByCollection?collection=${c}&limit=${PAGE_SIZE}${cursor}`,
    ),
  );
  if (!page) return false; // relay unreachable: try again next tick, from the same place
  const repos = arr(page.repos);
  for (const r of repos) {
    const did = str(obj(r)?.did);
    if (did) state.queue.push(`${state.collection}${KEY_SEPARATOR}${did}`);
  }
  const next = str(page.cursor);
  if (next && repos.length > 0) {
    state.relayCursor = next;
    return true;
  }
  state.relayCursor = undefined;
  state.collection++;
  if (state.collection >= COLLECTIONS.length) {
    state.collection = 0;
    state.lastFullAt = d.now;
  }
  return true;
}

/** Reads one queued repo's records for one collection and indexes them. */
async function readRepo(entry: string, d: BackfillDeps): Promise<boolean> {
  const [ci, did = ""] = entry.split(KEY_SEPARATOR);
  const collection = COLLECTIONS[Number(ci)] ?? LISTING_COLLECTION;
  const pds = await pdsFor(did, d.fetchJSON);
  const list = pds
    ? obj(
        await d.fetchJSON(
          `${pds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${collection}&limit=${PAGE_SIZE}`,
        ),
      )
    : undefined;
  if (!list) return false;
  const records = arr(list.records);
  const rkeys: string[] = [];
  for (const r of records.filter(isObject)) {
    const rkey = str(r.uri)?.split("/").pop();
    if (!rkey) continue;
    rkeys.push(rkey);
    await d.upsert(collection, did, rkey, r.value);
  }
  // A complete listing (no further page) tells us what the repo no longer holds.
  if (!list.cursor || records.length < PAGE_SIZE) await d.reconcile(collection, did, rkeys);
  return true;
}

/** One run: list more repos if the queue is empty and a pass is due, then read as many queued repos as the budget allows. */
export async function backfillStep(s: BackfillState, d: BackfillDeps): Promise<{ state: BackfillState; read: number }> {
  const state: BackfillState = { ...s, queue: [...s.queue] };
  let budget = d.budget;
  let read = 0;
  const passing =
    state.relayCursor !== undefined || state.collection > 0 || d.now - state.lastFullAt >= FULL_PASS_EVERY;
  if (state.queue.length === 0 && passing && budget > 0) {
    budget--;
    if (!(await listRepos(state, d))) return { state, read };
  }
  while (state.queue.length > 0 && budget >= REQUESTS_PER_REPO) {
    budget -= REQUESTS_PER_REPO;
    const entry = state.queue[0] as string;
    const ok = await readRepo(entry, d);
    state.queue.shift();
    if (ok) read++;
  }
  return { state, read };
}
