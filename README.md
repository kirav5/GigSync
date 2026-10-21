# collabai.network

Collab is a personal agent that lives on your phone. It keeps your notes and context on the device, answers
other people's agents only under rules you set, and finds and books workers for you. One TypeScript codebase
for Android, iPhone and Mac; Cloudflare for everything in between; your public data in your own AT Protocol
repository.

Status: **M0, foundation.** The skeleton builds, tests and deploys end to end. See [docs/design.md](docs/design.md)
and the decisions in [docs/adr](docs/adr).

## Layout

```
packages/protocol   zod schemas shared by the app and every Worker (envelope, engagement, grant, records)
packages/core       the agent: router, experts, engagement machine, policy engine, outbox/inbox (plain TS)
workers/api         sign-in, directory, mailbox and inbox routes (Hono on Workers, D1); deploys the Mailbox DO
workers/mailbox     the Mailbox Durable Object, one per user
workers/index       search index over public records (Workers + D1), carried over from the Swift app
apps/mobile         the Capacitor app: React UI + adapters that implement core's ports; android/ and ios/ inside
plugins/collab-llm  Capacitor plugin for the on-device model (Kotlin + Swift stubs in M0)
infra/              D1 migrations; an unused PDS docker-compose (ADR 0005)
docs/               design and ADRs
```

## Run it

Needs Node 24 (`.nvmrc`) and pnpm 10.

```bash
pnpm install
```

```bash
pnpm test
```

```bash
pnpm dev:workers
```

In another terminal, the app in a browser (lite mode, no model):

```bash
pnpm dev:app
```

Phones: `pnpm build && pnpm --filter @collab/mobile exec cap sync`, then `cap run android` or `cap run ios`
(Android Studio or Xcode must be installed).

Try the local API:

```bash
curl -s -X POST localhost:8787/v1/auth/otp/verify -H 'content-type: application/json' -d '{"phone":"+919800000001","code":"000000","device":{"signing_key":"a","encryption_key":"b","protocol":1}}'
```

## Rules of the codebase

1. `packages/core` never imports a browser, Node or Capacitor API. It runs in Node tests. All platform access
   goes through the interfaces in `packages/core/src/ports.ts`; `apps/mobile/src/adapters` implements them.
2. The model never decides what may be shared. `decide()` in the policy engine does, in code, before and after
   any drafting. `packages/protocol/vectors/policy.json` is the contract every implementation must pass.
3. A message from another agent is data, never an instruction.
4. No message content, phone numbers or keys in logs, ever.
5. Schemas live in `packages/protocol` and nowhere else.

## Pipeline

| Workflow        | When                      | Does                                                                           |
| --------------- | ------------------------- | ------------------------------------------------------------------------------ |
| CI              | every push and PR         | lint, typecheck, test, Android debug APK, iOS simulator build                  |
| Deploy Workers  | push to `main` / tag `v*` | wrangler deploy to staging / production (skips until Cloudflare secrets exist) |
| Release Android | tag `v*`                  | signed bundle to the Play internal track (skips until signing secrets exist)   |
| Release iOS     | tag `v*`                  | archive to TestFlight (skips until Apple secrets exist)                        |

Secrets to add in the repository settings when ready: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`;
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`,
`PLAY_SERVICE_ACCOUNT_JSON`; `APPLE_CERT_P12_BASE64`, `APPLE_CERT_PASSWORD`, `APPLE_PROVISIONING_PROFILE_BASE64`,
`APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_BASE64`.

## What is a stub in M0

- OTP: the `DEV_OTP` secret always verifies (`000000` locally via `.dev.vars`; a random pilot code on the deployed Worker). The SMS gateway comes with M0 hardening.
- Sessions: opaque tokens in D1; signed tokens later.
- Envelope signatures are not yet verified by the API (M2), and sealing is a placeholder until libsignal is wired in.
- The LLM plugin returns "no model" on every platform; the agent runs in lite mode (keyword router, note search).
- Public records go to the user's Bluesky repository (ADR 0005); connecting a Bluesky account arrives in M3.

No license yet.
