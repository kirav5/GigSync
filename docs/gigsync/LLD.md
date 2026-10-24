# GigSync — Low-Level Design (LLD)

> Status: **draft v0.1, 25 Oct 2026.** Read [HLD.md](HLD.md) first. Code names below are the target names after
> the G0 rebrand (`@gigsync/*`). Today's packages are still `@collab/*`; §14 maps old names to new ones.
> "Exists" marks code already in this repo; everything else is planned.

## 1. Repository layout

```text
GigSync/
├─ apps/
│  ├─ mobile/              @gigsync/mobile     Capacitor app (worker + employer modes)          exists (as Collab)
│  └─ desk/                @gigsync/desk       Tauri 2 union/helpline desk on Tilekit            planned
├─ packages/
│  ├─ protocol/            @gigsync/protocol   zod schemas, canonical JSON, test vectors         exists, extended
│  ├─ core/                @gigsync/core       agent: router, experts, job machine, policy,      exists, extended
│  │                                          sanitizer, ledger, mail, export
│  ├─ crypto/              @gigsync/crypto     seal/open, sign/verify, terms hash, blind keys    planned
│  └─ tilekit-client/      @gigsync/tilekit-client  typed Tilekit REST + SSE client              G0 (this branch)
├─ plugins/
│  ├─ gigsync-llm/         on-device LLM (LiteRT-LM / llama.cpp) behind the Model port           exists (as collab-llm)
│  ├─ gigsync-speech/      IndicConformer ASR + IndicTrans2 MT via ONNX Runtime / LiteRT         planned
│  └─ gigsync-store/       SQLCipher + Android Keystore bridge                                    planned
├─ workers/
│  ├─ api/                 Hono API: auth, directory, mailbox front door                          exists
│  ├─ mailbox/             Mailbox Durable Object                                                 exists
│  ├─ notifier/            Queue consumer → FCM                                                    planned
│  ├─ board/               Job board (public profiles, open jobs)                                 planned (from workers/index)
│  └─ ondc-relay/          ONDC BAP/BPP bridge                                                     spike
├─ android-responder/      Kotlin background responder (FCM-woken)                                planned
├─ tiles/
│  ├─ gigsync.modelfile    persona + parameters, single source for phone and desk                 G0
│  └─ plugin/              Tiles Agent Plugin: plugin.json + skills/*                              G0
├─ infra/wrangler/d1/      D1 migrations                                                           exists
└─ docs/{gigsync,adr}/     HLD, LLD, ADRs
```

Dependency rule: `protocol` ← `crypto` ← `core` ← (`mobile`, `desk`, workers). `core` imports nothing from
Capacitor, the browser, Tauri or Workers; platforms implement its ports.

## 2. Protocol (`packages/protocol`)

All schemas are zod; every wire object is signed over `canonicalJson()` (exists in `envelope.ts`).

### 2.1 IDs (`ids.ts`, extended)

`<prefix>_<ULID>`. Existing: `usr`, `dev`, `msg`, `eng`, `chn`, `grt`. New:

| Prefix | Type              | Meaning                                  |
| ------ | ----------------- | ---------------------------------------- |
| `job`  | `JobId`           | A job (replaces `eng` for GigSync flows) |
| `agr`  | `AgreementId`     | One signed version of terms              |
| `rcp`  | `ReceiptId`       | A visit or payment receipt               |
| `evp`  | `EvidencePackId`  | An evidence pack                         |
| `flg`  | `FlagId`          | A union "do not accept" flag             |
| `wrk`  | `WorkerProfileId` | Local profile in shared-phone mode       |

### 2.2 Envelope (`envelope.ts`, exists; kinds extended)

```ts
EnvelopeHeader = { v: 1, id: MsgId, from: { user: UserId, device: DeviceId }, to: { user: UserId },
  engagement: JobId | EngagementId, seq: number, kind: EnvelopeKind, sent_at: ISO, expires_at: ISO, hop: 0..3 }
Envelope = { header: EnvelopeHeader, ciphertext: base64url, keys: { [device: DeviceId]: base64url }, sig: base64url }
```

`EnvelopeKind` = existing `request | clarify | response | quote | agree | update | delivery | review | cancel |
receipt | key_change` **plus** `job_request | job_offer | job_counter | contact_release | contact_revoke |
evidence_pack | flag_publish | flag_withdraw`.

TTL: `job_request` 24 h, `job_offer`/`job_counter` 24 h, `agree` 7 d, `receipt` 7 d, `evidence_pack` 7 d.

### 2.3 Job terms and agreement (`job.ts`, new)

```ts
Category = z.enum([
  "domestic",
  "cooking",
  "cleaning",
  "childcare",
  "eldercare",
  "beauty",
  "home_repair",
  "delivery",
  "ride",
  "construction",
  "piecework",
]);
Money = z.object({ paise: z.number().int().nonnegative() }); // integers only, never floats
Schedule = z.object({
  days: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).min(1),
  start_hour: z.number().int().min(0).max(23),
  end_hour: z.number().int().min(1).max(24),
  weekly_off: z.array(DayOfWeek).default([]),
});
Rate = z.discriminatedUnion("unit", [
  z.object({ unit: z.literal("hour"), amount: Money }),
  z.object({ unit: z.literal("visit"), amount: Money }),
  z.object({ unit: z.literal("month"), amount: Money, paid_leave_days: z.number().int().min(0) }),
  z.object({ unit: z.literal("piece"), amount: Money, piece: z.string().max(40) }),
]);
JobTerms = z.object({
  category: Category,
  area: Area /* geohash g5 until agreed */,
  schedule: Schedule,
  rate: Rate,
  start_date: ISODate,
  end_date: ISODate.optional(),
  notice_days: z.number().int().min(0).default(7),
  payment_mode: z.enum(["cash", "upi", "bank"]),
  payment_day: z.number().int().min(1).max(31).optional(),
  extras: z.array(z.string().max(80)).max(10).default([]), // free text, sanitized
});
Agreement = z.object({
  id: AgreementId,
  job: JobId,
  terms: JobTerms,
  terms_hash: Hex32, // sha256(canonicalJson(terms))
  worker: UserId,
  employer: UserId,
  supersedes: AgreementId.optional(),
  sigs: z.object({ worker: Sig, employer: Sig }), // each over terms_hash||job||id
  agreed_at: ISO,
});
```

### 2.4 Receipts (`receipt.ts`, new)

```ts
Receipt = z.object({
  id: ReceiptId,
  job: JobId,
  agreement: AgreementId,
  type: z.enum(["check_in", "check_out", "payment", "leave", "absence", "deduction"]),
  at: ISO,
  amount: Money.optional(),
  note: z.string().max(280).optional(), // sanitized before signing
  prev: Hex32, // hash of previous ledger entry
  issuer: UserId,
  sig: Sig,
  countersig: Sig.optional(),
  countersigned_at: ISO.optional(),
});
```

### 2.5 Grants (`grant.ts`, exists; topics extended)

`Topic` gains `contact`, `rate`, `ledger`, `safety`. `Precision` unchanged (city → exact). New `ContactGrant`:

```ts
ContactGrant = Grant.extend({
  topic: z.literal("contact"),
  fields: z.array(z.enum(["name", "phone", "address", "aadhaar_last4"])).min(1),
  job: JobId,
  opens_on: z.literal("agreement"),
  closes_on: z.enum(["job_end", "date"]),
  closes_at: ISO.optional(),
});
```

### 2.6 Evidence packs and exports (`evidence.ts`, new)

```ts
Scope = z.enum(["full", "wage_claim", "welfare", "flag_only"]);
EvidencePack = z.object({
  id: EvidencePackId,
  v: z.literal(1),
  worker: UserId,
  receiver: UserId | z.literal("file"),
  scope: Scope,
  created_at: ISO,
  period: z.object({ from: ISODate, to: ISODate }),
  agreements: z.array(Agreement),
  receipts: z.array(Receipt),
  summary: z.object({ days_worked: z.number().int(), earned: Money, paid: Money, owed: Money }),
  notes: z.array(z.object({ at: ISO, text: z.string().max(2000) })).default([]), // full scope only
  sig: Sig,
});
```

Scope projection (enforced in `core/export/project.ts`, test vectors in `vectors/export.json`):

| Field       | full |      wage_claim       |   welfare    | flag_only |
| ----------- | :--: | :-------------------: | :----------: | :-------: |
| agreements  |  ✓   |           ✓           |      —       |     —     |
| receipts    |  ✓   | payment, check_in/out | check_in/out |     —     |
| summary     |  ✓   |           ✓           | days, earned |     —     |
| notes       |  ✓   |           —           |      —       |     —     |
| employer id |  ✓   |           ✓           |      —       | blind key |

### 2.7 Union flags (`flag.ts`, new)

```ts
Flag = z.object({
  id: FlagId,
  union: UserId,
  subject: BlindKey /* HMAC(union_key, employer_user_id) */,
  reason_code: z.enum(["harassment", "non_payment", "unsafe", "other"]),
  issued_by: UserId,
  issued_at: ISO,
  expires_at: ISO,
  sig: Sig /* issuer */,
  union_sig: Sig /* union countersign */,
});
```

Only `reason_code`, never her story, travels. The union key is shared with members' phones when they join.

### 2.8 Public records (`records.ts`, exists; NSIDs renamed)

`app.gigsync.worker.profile` `{ name, categories: Category[], languages, area{g4,g5}, hours, about }`,
`app.gigsync.job.open` `{ category, title, text, rate?, area, expiresAt }`, `app.gigsync.review` (only for a
both-signed completed job). No phone, address or exact location is ever a public field.

### 2.9 Test vectors

`vectors/policy.json` (exists) gains contact-grant and flag cases; new `vectors/terms_hash.json`,
`vectors/export.json`, `vectors/sanitizer.json`. TS (vitest) and Kotlin (JUnit) both run them in CI.

## 3. Agent core (`packages/core`)

### 3.1 Ports (`ports.ts`, exists; extended)

```ts
interface Storage { get/put/list/delete(collection, key, value) }          // exists; SQLCipher on phone
interface Keys    { deviceId(); sign(bytes); publicKeys(); open(env); seal(body, recipients) }
interface Model   { status(): ModelStatus; generate(req): Promise<string> } // exists; NoModel default
interface Speech  { transcribe(audio, lang): Promise<Transcript>; translate(text, from, to) }   // new
interface Clock   { now(): Date }                                            // exists
interface Push    { token(): Promise<string | null> }                        // new
```

New storage collections: `jobs`, `agreements`, `receipts`, `ledger_head`, `rules`, `grants`, `shared_context`,
`audit`, `flags`, `evidence_out`, `profiles` (shared-phone mode).

### 3.2 Job state machine (`job/machine.ts`, from `engagement/machine.ts`)

| From \ event | job_request | job_offer / counter   | agree (both)      | check_in | check_out / payment | dispute  | cancel    | expire  |
| ------------ | ----------- | --------------------- | ----------------- | -------- | ------------------- | -------- | --------- | ------- |
| (none)       | requested   | —                     | —                 | —        | —                   | —        | —         | —       |
| requested    | —           | negotiating           | —                 | —        | —                   | —        | cancelled | expired |
| negotiating  | —           | negotiating           | agreed            | —        | —                   | —        | cancelled | expired |
| agreed       | —           | negotiating (new agr) | —                 | active   | —                   | disputed | cancelled | —       |
| active       | —           | negotiating (new agr) | —                 | active   | active              | disputed | ended     | —       |
| disputed     | —           | —                     | agreed (resolved) | —        | disputed            | —        | ended     | —       |

Side effects: entering `agreed` opens the `ContactGrant` and writes an `Agreement` ledger entry; entering
`ended` or `cancelled` closes contact grants and purges `shared_context` for that job. Invalid transitions throw
`TransitionError` (exists).

### 3.3 Policy checker (`policy/engine.ts`, exists; rules extended)

`decide(request, grants, rules, now) → Decision` stays pure and synchronous. GigSync rules (owner-set):

```ts
WorkerRules = { min_rate: { hour?: Money, visit?: Money, month?: Money }, areas: Geohash5[],
  hours: HourWindow[], categories: Category[], max_jobs_per_day: number,
  auto_reply: "never" | "counter_below_min" | "accept_if_all_match",
  flagged: "warn" | "decline" }
```

Evaluation order (first deny wins; most restrictive mode wins): `expired` → `flagged` (if `decline`) →
`outside_area` → `outside_hours` → `category` → `below_min_rate` (→ auto-counter if allowed) → `capacity` →
allow with mode `ask` (default) or `auto` (only under `accept_if_all_match`). `DenyReason` gains `flagged`,
`outside_area`, `below_min_rate`, `capacity`, `category`.

### 3.4 Sanitizer (`pii/`, from upstream's ADR 0008 work)

`sanitize(text) → { text, map: Map<Placeholder, string> }`. Detectors run in a fixed order, longest match first:

| Kind                   | Rule                                | Check        |
| ---------------------- | ----------------------------------- | ------------ |
| AADHAAR                | 12 digits, first 2–9, spaced or not | Verhoeff     |
| CARD                   | 13–19 digits                        | Luhn         |
| PAN                    | `[A-Z]{5}[0-9]{4}[A-Z]`             | 4th char set |
| UPI                    | `[\w.-]{2,256}@[a-z]{2,64}`         | handle list  |
| IFSC                   | `[A-Z]{4}0[A-Z0-9]{6}`              | —            |
| PHONE                  | `(\+91[\s-]?)?[6-9]\d{9}`           | —            |
| EMAIL                  | RFC 5322 subset                     | —            |
| VOTER_ID, DL, PASSPORT | state formats                       | —            |

`restore(text, map, allowed: Set<Kind>)` puts real values back only for kinds the policy allowed. The map never
leaves the phone and is never logged (`pii()` in `log.ts`).

### 3.5 Message pipeline (`pipeline/`, new)

```text
voice/tap → Speech.transcribe (optional) → sanitize → intent (keyword router → Model if unsure)
  → decide() → draft (template | Model phrasing) → confirm card → restore(allowed) → sign → seal → outbox
```

Every step after `sanitize` sees placeholders only. If `Model.status()` is `none` or RAM < threshold, intent and
draft fall back to the keyword router and templates (`templates/{hi,te,en}.json`).

### 3.6 Ledger (`ledger/`, new)

Append-only, hash-chained per worker: `entry_hash = sha256(prev || canonicalJson(entry))`. `ledger_head` keeps
the last hash. `verifyChain(entries)` is run on export and on restore. Entries: `Agreement`, `Receipt`, `Note`,
`GrantEvent`, `Disclosure`. Countersign timeout: 48 h → marked `unilateral`.

### 3.7 Disclosure audit (`audit/`, new)

Every outgoing fact writes `{ at, to, job?, fields[], rule_id | "manual", envelope_id }`. The "What my agent
shared" screen reads it; revoking a rule writes `GrantEvent{revoked}` and sends `contact_revoke` where relevant.

### 3.8 Export (`export/`, new)

`buildPack(scope, period, receiver)` → project (§2.6) → sanitize notes → sign → seal for receiver or write a
`.gigsync.json` file plus a printable PDF summary (rendered on the phone). Exports are logged as disclosures.

### 3.9 Mail (`mail/`, exists)

Outbox: durable queue, exponential backoff capped at 10 min (exists). Inbox: outcomes `new | duplicate | expired
| held` with per-engagement `seq` gap holding (exists). Signature verification moves into `crypto` (TODO M2 in
upstream).

## 4. Crypto (`packages/crypto`, new)

| Function                       | Algorithm                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `seal(body, recipientDevices)` | XChaCha20-Poly1305, random 32-byte CEK; CEK wrapped per device with X25519 + HKDF-SHA256 |
| `open(envelope, myDevice)`     | reverse; rejects if `sig` fails before decrypting                                        |
| `sign(bytes)` / `verify`       | Ed25519 (`@noble/ed25519`, exists in app)                                                |
| `termsHash(terms)`             | SHA-256 over `canonicalJson`                                                             |
| `blindKey(unionKey, userId)`   | HMAC-SHA256, truncated to 16 bytes, base32                                               |
| `backupKey(recoveryCode)`      | Argon2id (m=64 MB, t=3) → XChaCha20 key                                                  |

On Android the private keys live in the Keystore; the TS side calls them through `plugins/gigsync-store`.
libsignal is a later upgrade for forward secrecy (upstream ADR note).

## 5. Mobile app (`apps/mobile`)

Screens (React, voice-first, large tap targets, icon + audio label for each action):

| Screen                  | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| Onboarding              | Language, OTP, PIN, recovery code, worker/employer mode        |
| Today                   | Jobs today; check-in/out buttons; payment due                  |
| Requests                | Incoming job requests with policy verdict and flag colour      |
| Confirm card            | "Send this?" with exact fields going out; send / edit / cancel |
| My rules                | Min rate, areas, hours, auto-reply, flag handling              |
| My record               | Ledger by month; days worked, earned, paid, owed               |
| Share / complain        | Pick receiver + scope → preview → send pack or save file       |
| What my agent shared    | Disclosure audit; revoke                                       |
| Profiles (shared phone) | Switch worker; each has own PIN and SQLCipher DB               |

**Shared-phone mode:** one SQLCipher file per `wrk_` profile, each key wrapped by that worker's PIN (Argon2id)
and the Keystore. Notifications show only "GigSync: 1 new request" with no name, and open the profile picker.

## 6. Background responder (`android-responder/`, Kotlin)

Woken by FCM data message `{ t: "wake" }` (no content). Opens the active profile's DB read-only with a
Keystore-held key, fetches the inbox, verifies, runs the Kotlin port of `decide()` and replies **only** when the
decision is `auto` (e.g. counter below minimum, or decline outside area). Anything else becomes a local
notification. CI fails if Kotlin and TS disagree on any vector.

## 7. Cloud (Cloudflare)

### 7.1 API Worker (`workers/api`, exists; routes extended)

| Method | Path                     | Auth           | Purpose                                         | Status           |
| ------ | ------------------------ | -------------- | ----------------------------------------------- | ---------------- |
| GET    | `/health`                | —              | Liveness                                        | exists           |
| POST   | `/v1/auth/otp/request`   | —              | Send OTP; IP and per-number rate limits         | exists           |
| POST   | `/v1/auth/otp/verify`    | —              | Verify, register device keys, return session    | exists           |
| GET    | `/v1/directory/:user`    | Bearer         | Active devices and public keys                  | exists           |
| POST   | `/v1/mailbox/:user`      | Bearer         | Deliver envelope (verify `from` = session, sig) | exists, sig TODO |
| GET    | `/v1/inbox`              | Bearer         | Fetch for this device                           | exists           |
| POST   | `/v1/inbox/ack`          | Bearer         | `{ids[]}` → delete                              | exists           |
| POST   | `/v1/devices/push`       | Bearer         | Set/rotate FCM token                            | new              |
| POST   | `/v1/devices/:id/revoke` | Bearer         | Revoke a device, emit `key_change`              | new              |
| POST   | `/v1/unions/:id/join`    | Bearer         | Join request (union approves on its Desk)       | new              |
| GET    | `/v1/unions/:id/flags`   | Bearer, member | Signed flag list since cursor                   | new              |
| DELETE | `/v1/account`            | Bearer         | DPDP erasure: directory, sessions, mailbox      | new              |

Errors: `{ error: { code, message, request_id } }`, codes `bad_request | unauthorized | forbidden | not_found |
rate_limited | conflict | internal`. Every response carries `x-request-id` (exists).

### 7.2 D1 additions (`infra/wrangler/d1/directory/0003_gigsync.sql`)

```sql
ALTER TABLE users ADD COLUMN mode TEXT NOT NULL DEFAULT 'worker' CHECK (mode IN ('worker','employer','union'));
CREATE TABLE unions (union_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(user_id),
  name TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE union_members (union_id TEXT NOT NULL REFERENCES unions(union_id), user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member','organiser')), joined_at INTEGER NOT NULL, left_at INTEGER,
  PRIMARY KEY (union_id, user_id));
CREATE TABLE union_flags (flag_id TEXT PRIMARY KEY, union_id TEXT NOT NULL REFERENCES unions(union_id),
  body TEXT NOT NULL /* signed Flag JSON, blind subject only */, issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, withdrawn_at INTEGER);
CREATE INDEX union_flags_by_union ON union_flags(union_id, issued_at);
```

### 7.3 Mailbox DO (`workers/mailbox`, exists)

SQLite `envelopes(msg_id, device_id, body, expires_at)`, `seen(msg_id, at)`; RPC `deliver` (idempotent, TTL ≤ 7
d), `fetchFor(device)`, `ack`, `pending`; `alarm()` purges expired. **New:** after `deliver`, if the device has
no open WebSocket, enqueue `{user, device}` to `NOTIFY_QUEUE`.

### 7.4 Notifier (`workers/notifier`, new)

Queue consumer; batches by device, de-duplicates within 30 s, sends FCM HTTP v1 data message `{t:"wake"}` with
`priority: high`. Token errors mark the device's push token stale in D1.

### 7.5 Job board (`workers/board`, from `workers/index`)

Postgres + PostGIS through Hyperdrive. Ingests `app.gigsync.*` records from Jetstream (the index's existing
`IndexHub` DO) and serves:

`GET /v1/board/workers?category&near=g5&lang` · `GET /v1/board/jobs?category&near=g5` ·
`POST /v1/board/jobs` (employer-signed). Tables: `worker_profiles(did, categories[], languages[], g5, geom,
updated_at)`, `open_jobs(id, did, category, rate_paise, g5, geom, expires_at)`; GiST index on `geom`.

### 7.6 ONDC relay (`workers/ondc-relay`, spike)

Acts as a BPP on ONDC mobility/logistics; maps `on_search`/`on_select`/`on_confirm` to `job_request`/
`job_offer`/`agree` envelopes for opted-in workers. A phone cannot be an ONDC participant; the relay holds no
private data beyond the in-flight order id.

## 8. Tilekit integration

### 8.1 `@gigsync/tilekit-client` (this branch)

A dependency-free TypeScript client for the Tiles daemon's Tilekit REST API.

```ts
const tiles = new TilekitClient({ baseUrl: "http://127.0.0.1:1729" });
await tiles.ping(); // GET  /v1/tilekit/server/ping
await tiles.startServer(); // POST /v1/tilekit/server/start
const { id } = await tiles.newSession(); // POST /v1/tilekit/session/new
for await (const ev of tiles.prompt("Summarise this evidence pack …")) {
  /* SSE: agent_start, message_end … */
}
await tiles.saveChat({ session_id: id, role: "user", text });
```

- Unwraps `{status:"success",data}` and throws `TilekitError(reason, httpStatus)` on `{status:"failed"}`.
- `prompt()` reads SSE from a POST body with `fetch` streams (`EventSource` cannot POST).
- Sends `Content-Type: application/json` on every POST (Tiles PR #277 will require it).
- Pins a daemon version: `assertVersion(min)` reads `GET /` and refuses unknown majors.

### 8.2 GigSync Desk (`apps/desk`, G2)

Tauri 2 (CORS allows `tauri://localhost`). Flow for a received pack:
1. Desk's `@gigsync/core` (desk mode, union identity) fetches and opens the `evidence_pack` envelope.
2. `verifyChain` + signature checks; renders the timeline and summary **without any model**.
3. On "Draft grievance", Desk sanitizes the pack text, starts a Tilekit session, and sends a prompt built from
   `tiles/plugin/skills/gigsync-grievance/SKILL.md`. The draft streams back over SSE and runs entirely on the
   union's laptop.
4. Organiser edits and exports; placeholders are restored only in the final document, on the laptop.
5. Flag issuance: organiser signs a `Flag`, Desk countersigns with the union key, `POST`s to D1 via the API.

### 8.3 Modelfile (`tiles/gigsync.modelfile`)

The one source for persona and parameters. Tiles reads it with `tiles run tiles/gigsync.modelfile`. The phone
reads the same file at build time (a ~60-line TS parser for `FROM`, `SYSTEM`, `PARAMETER` in
`plugins/gigsync-llm/scripts/`) and maps `FROM` to its on-device equivalent through `tiles/model-map.json`
(e.g. Gemma 12B GGUF on desk → a ≤2B LiteRT model on the phone).

### 8.4 Agent Plugin (`tiles/plugin/`)

`plugin.json` (Agent Plugins 1.0.0) plus skills: `gigsync-grievance` (draft a complaint from a pack),
`gigsync-explain` (explain an agreement in plain Hindi/Telugu/English). Install: `tiles plugin install
./tiles/plugin` → used as `@gigsync-grievance` in Tiles chat.

### 8.5 Eval harness (`scripts/eval-tiles.mjs`, G3)

Runs `vectors/prompts/*.json` (sanitized intents and drafts in three languages) through Tilekit against the desk
model and the phone-equivalent model, scoring placeholder preservation (must be 100%), intent accuracy and
template-fallback rate.

## 9. On-device models

| Part        | Model                       | Runtime               | Size           | Fallback           |
| ----------- | --------------------------- | --------------------- | -------------- | ------------------ |
| ASR         | AI4Bharat IndicConformer    | ONNX Runtime          | ~130 MB/lang   | Tap UI             |
| Translation | IndicTrans2 distilled 200M  | ONNX / LiteRT         | ~400 MB (int8) | Same-language only |
| Phrasing    | ≤2B open model (Apache 2.0) | LiteRT-LM / llama.cpp | ~1.2 GB q4     | Templates          |
| Intent      | Keyword router (exists)     | none                  | —              | —                  |

`Model.status()` reports `none | downloading | ready | low_memory`. Downloads only on Wi-Fi, resumable, SHA-256
verified against `model-map.json`.

## 10. Observability

One logger (`log.ts`, exists): `pii()` wrapper for any value that might identify a person; `LOG_PII` honoured only
when `ENVIRONMENT=local`. Phone logs stay on the phone (ring buffer, 1 MB); a user-initiated "send logs" passes
through the sanitizer first. Workers emit structured JSON with `request_id`; metrics: envelopes delivered,
time-to-ack, push failures, OTP failures, per-route p95. No analytics without the `analytics` consent.

## 11. Testing

| Layer            | Tool                              | What                                                                    |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------- |
| Protocol         | vitest                            | schemas round-trip; `terms_hash`, export, sanitizer vectors             |
| Core             | vitest                            | job machine table, `decide()` vectors, ledger chain, pipeline fallbacks |
| Kotlin responder | JUnit                             | same `policy.json` vectors                                              |
| Workers          | vitest + Miniflare                | routes, auth, mailbox idempotency, notifier dedupe                      |
| Tilekit client   | vitest with mocked `fetch`        | envelope unwrap, error mapping, SSE parsing                             |
| Data-flow        | integration                       | no plaintext PII reaches any Worker (grep captured bodies)              |
| Device           | Firebase Test Lab, ₹10–15k phones | cold start, RAM, model latency, battery                                 |

## 12. CI/CD

Existing workflows kept: `ci.yml` (lint, build, typecheck, test), `deploy-workers.yml` (main only; skips without
Cloudflare secrets), `mobile-builds.yml`, `release-android.yml`, `release-ios.yml`. Add: Kotlin vector job, Desk
Tauri build on tag. Branch → PR → green → squash merge; DCO sign-off (see `.claude/skills/git-workflow`).

## 13. Error handling and limits

| Limit               | Value                                           |
| ------------------- | ----------------------------------------------- |
| Envelope body       | 64 KB (evidence packs: 1 MB, chunked)           |
| Mailbox per device  | 500 pending; oldest `job_request` dropped first |
| OTP                 | 10 / 60 s per IP; 5 failures / hour per number  |
| Chain depth         | `MAX_HOP_DEPTH = 3` (exists)                    |
| Countersign timeout | 48 h → `unilateral`                             |
| Contact grant max   | job end or 90 days, whichever first             |

## 14. Rebrand map (G0 follow-up PR)

| Today (collabai.network)                            | GigSync                                                |
| --------------------------------------------------- | ------------------------------------------------------ |
| root `collabai.network`, scope `@collab/*`          | `gigsync`, `@gigsync/*`                                |
| wrangler `collab-api`, `collab-index`, `collab-app` | `gigsync-api`, `gigsync-board`, `gigsync-app`          |
| D1 `collab-directory`, `collab-index`               | new DBs `gigsync-directory`, `gigsync-board` (new ids) |
| domains `api.collabai.network`, `collabai.network`  | `[gigsync domain]` — to choose                         |
| NSIDs `network.collabai.*`, `dev.collab.*`          | `app.gigsync.*` (pending domain)                       |
| appId `network.collabai.app`, "Collab"              | `app.gigsync`, "GigSync"                               |
| `plugins/collab-llm`, `CollabLLM*`                  | `plugins/gigsync-llm`, `GigSyncLLM*`                   |
| workers.dev fallback `collab-index-worker`          | new subdomain                                          |

The rename is one mechanical PR after this one, followed by `pnpm install` (lockfile) and `npx cap sync`.
