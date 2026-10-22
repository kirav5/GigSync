// Names and limits the index uses in more than one place, or whose meaning a bare value would hide.

/** HTTP routes of the index Worker. */
export const Path = {
  health: "/health",
  notes: "/notes",
  query: "/query",
  publish: "/publish",
  subscribe: "/subscribe",
} as const;

/** Query parameters of GET /notes. */
export const NotesParam = { q: "q", did: "did", limit: "limit" } as const;
export const MAX_SEARCH_LENGTH = 200;

/** Jetstream: the event kind for repo writes, and what a write did. */
export const JETSTREAM_COMMIT = "commit";
export const CommitOp = { create: "create", update: "update", delete: "delete" } as const;
/** Replay this far behind the saved cursor on reconnect (microseconds), so nothing between is missed. */
export const CURSOR_REWIND_US = 5_000_000;

/** Keys in the hub's Durable Object storage. */
export const StorageKey = { cursor: "cursor", backfill: "backfill" } as const;
/** The single IndexHub instance every request talks to. */
export const HUB_NAME = "main";

/** Tables a record can be indexed in, by collection. */
export const Table = { listings: "listings", notes: "notes" } as const;

/** NIP-99 listing tags the index reads. */
export const NostrTag = {
  identifier: "d",
  topic: "t",
  geohash: "g",
  expiration: "expiration",
  status: "status",
  price: "price",
  collab: "collab",
} as const;
export const LISTING_STATUS_ACTIVE = "active";
/** Collab categories are `t` tags with this prefix, e.g. collab-electrician. */
export const CATEGORY_PREFIX = "collab-";
/** Geohash lengths stored as columns g4, g5, g6. */
export const GEOHASH_LENGTHS = [4, 5, 6] as const;

/** Rows that are no longer live: listing expired, sold or withdrawn. */
export const REMOVE = "remove";

const SECONDS_PER_DAY = 86_400;
/** A listing with no expiration tag lives this long; tombstones are kept this long too. */
export const DEFAULT_LISTING_TTL = 30 * SECONDS_PER_DAY;

/** Join character in composite keys: `pubkey|d` for listings, `collectionIndex|did` in the backfill queue. */
export const KEY_SEPARATOR = "|";

/** How a DID document names the repo's PDS. */
export const PDS_SERVICE_ID = "#atproto_pds";
export const PDS_SERVICE_TYPE = "AtprotoPersonalDataServer";
