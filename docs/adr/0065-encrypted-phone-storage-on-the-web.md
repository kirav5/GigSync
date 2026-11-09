# ADR 0065: The phone's storage, encrypted in IndexedDB on the web; native stays put until SQLCipher

Date: 2026-11-09. Status: proposed (a draft, written with the change that builds the web half; the native half is
not built). Builds the web half of the phone-side store the LLD plans (`gigsync-store`, G1b: "SQLCipher +
Keystore/Keychain; encrypted IndexedDB on web") and names what is still owed on Android and iPhone.

## Context

Everything an owner's agent knows lives only on the phone: jobs and their signed terms, chats, the session token, the
UPI ID, a worker's lowest rate, the device's two private keys. Until this change all of it sat in Capacitor
Preferences as plain JSON, one flat list of `<collection>:<id>` keys.
- On the web (the PWA every pilot owner uses) Preferences is `localStorage`: about 5 MB per origin, every call
  blocking the page, readable as text by anything that can open the browser's profile folder.
- Listing one collection read every key of every collection.
- `inbox_seen` gained one record per message received and never lost one.
- The device's keys were marked "DEV ONLY" and stored beside everything else.

## Decision

1. **IndexedDB on the web.** One database, `gigsync-store`, with one object store of records under the key
   `[collection, id]`. IndexedDB sorts array keys element by element, so a key range reads exactly one collection: no
   scan, no second index. An owner's collections already carry the owner in their name (`jobs@usr_…`,
   [ADR 0032](0032-data-kept-per-owner.md)), so the same range keeps owners apart. Core's `Storage` port is unchanged.
2. **Every value sealed.** AES-256-GCM, a fresh random 96-bit IV per write, and the record's collection and id
   authenticated with it, so a record copied over another, or into another owner's collection, does not open. The key
   is a WebCrypto `CryptoKey` made with `extractable: false` and kept in the same database: script can use it and can
   never read it. Stored per record: one version byte, the IV, the ciphertext and its tag (29 bytes over the JSON).
3. **What stays readable.** Collection names, owner ids and record ids are the database keys, in the clear: they say
   how many records of which kind a phone holds, for which user ids, and (ids are ULIDs) when each was made. Never
   what is in them. Two inbox ids also carry the other party's user id (`inbox_cursor`), as do `people`, `blocked`
   and mentor links: who an owner dealt with is visible as ids, not names.
4. **The device's keys** are one more sealed record (`keys` / `device:v2`). They are not held as non-extractable
   WebCrypto keys: `@gigsync/crypto` signs with Ed25519 and opens with X25519 through noble, which needs the raw
   bytes, and moving an owner to a new phone does not move them. So they are encrypted at rest and plain in memory
   while the app runs. WebCrypto can now do both curves in current browsers; using it means a second `Keys`
   implementation, new keys for every device (an existing key was already stored as text), and a floor on browser
   versions the pilot's phones may not meet. Not in this change.
5. **Native builds do not change yet.** `Capacitor.isNativePlatform()` keeps Android and iPhone on Preferences. A
   WebView has IndexedDB and WebCrypto too, but the key would not be hardware-backed, and iOS may clear a WebView's
   storage under pressure. The native store is SQLCipher through `@capacitor-community/sqlite`, its database key
   made on the device and held in the Android Keystore / iOS Keychain, behind the same `Storage` port, with the same
   move from Preferences. It needs a device build to verify and is its own change. `android:allowBackup` is already
   `false`.
6. **Moving the old store.** On every start, before the app reads anything: copy every old record into the new store
   in one flushed transaction, check each one is there, mark the move, then delete the plaintext. Until the mark the
   old store is the truth and nothing is deleted; after it the new store is, and plaintext that still turns up (a
   crash before the deleting finished, a tab still running the old app) is kept only where the new store has no such
   record, then deleted. Preferences that are not the agent's records (voice settings, which permissions were
   explained) stay where they are.
7. **Never an empty phone by accident.** Where IndexedDB or WebCrypto cannot be used (a private window, a page not
   on HTTPS, an old WebView) the app stays on the old store and logs a warning. Once a phone has moved, a note in
   the old store says so: if the encrypted store then fails to open, the app stops with an error instead of starting
   on the empty old store, where it would make new device keys and sign in over the owner's real ones.
8. **Asking the browser to keep it.** `navigator.storage.persist()` is asked once and the answer logged and kept.
9. **`inbox_seen` is pruned.** Ids seen more than 7 days ago (`DEFAULT_TTL_SECONDS.job`, the longest an envelope
   lives) are deleted, at most once a day, in core. A pruned id cannot be taken twice: its envelope has expired, and
   its sender's cursor is past it.

## What this protects against, and what it does not

| Who                                                                                                                               | Before                  | Now, on the web                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Another site or app on a phone that is not rooted                                                                                 | Kept out by the browser | The same: the browser's origin rule and the app sandbox do this, not the encryption                                                                                    |
| Someone with the browser's files (a device backup that includes them, a forensic image, a rooted phone, malware as the same user) | Read everything as text | Values are ciphertext, but the key is stored in the same files: whoever has the whole profile can open it in the same browser, or dig the key out. Slower, not stopped |
| Script running in the app's origin (XSS, a bad dependency, an extension allowed on the site)                                      | Read everything         | Reads everything through the key. It cannot take the key away, so it has to do its reading on the phone                                                                |
| Someone holding the unlocked phone                                                                                                | Read everything         | Reads everything in the app. Only DevTools shows ciphertext instead of text                                                                                            |
| The browser clearing storage                                                                                                      | Lost everything         | The same; asking for durable storage lowers the odds, and Safari may still clear a site not added to the Home Screen after 7 days unused                               |

The honest summary: this stops the stored values being read as text out of a file or a partial copy, stops a record
being moved or swapped unnoticed, and keeps the storage key from being carried off by script. It is not protection
from someone who has the whole browser profile, from the operating system, or from code running as the app. Only a
key the hardware holds (decision 5) raises that, and only on native.

## Consequences

- Capacity is the browser's quota (a share of free disk, typically hundreds of MB) instead of 5 MB. Sizes measured
  over the browser tests' journeys, as JSON; each stored record adds 29 bytes and its key (collection, owner id and
  id, about 50–75 bytes): an `inbox_seen` row 33 bytes; a job 0.7–5.3 KB, median 1.3 KB; a chat 0.3–9 KB, median
  1.8 KB, about 0.2–0.5 KB a turn; a city guide 30 KB. A chat or a job is still one record, rewritten whole.
- Reads and writes no longer block the page. Each costs one small transaction and one AES-GCM call: 0.1–0.4 ms a
  write and under 0.2 ms a read for a 2 KB record, measured in Chromium and WebKit on a Mac; a phone will be slower.
- A write used to be kept the instant it was called. Now it is sealed first, so it is kept a moment later, and the
  screen can change before it is: a page closed within that moment of a tap loses that tap's record. Calls are still
  applied in the order they were made, and a read sees every write called before it.
- A record that cannot be opened makes `get` throw (a caller that took it for missing would overwrite it) and is
  left out of `list` with an error logged.
- The browser tests can no longer read or seed records through `localStorage`. The dev build puts the storage on
  `window.gigsyncStorage` for them; plaintext written before the app's first start is still taken in, as an old
  phone's is.
- `apps/mobile` gains a unit test runner (vitest, with `fake-indexeddb`) for `src/adapters/store`, so the key
  ranges, the sealing and the move are tested as they run in a browser. `pnpm test` now includes `apps/*`.
- A web page open from before the update keeps writing plaintext to the old store until it reloads; what it writes
  is taken in on the next start only where the new store has nothing, then deleted.
- Clearing site data deletes the key with the records. There is no recovery, as before; the server-held job record
  ([ADR 0038](0038-job-records-on-the-server.md)) and moving phones ([ADR 0037](0037-server-held-record-earnings-and-moving-phones.md))
  are what an owner has.

## Still to do

- The native store (decision 5), verified on an Android phone and an iPhone, including the move from Preferences.
- The move on a real, long-used browser profile; Safari on an iPhone, in and out of the Home Screen.
- Non-extractable device keys on the web (decision 4), if the pilot's browsers allow it.
