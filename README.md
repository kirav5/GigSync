# GigSync

GigSync gives a gig worker their own agent on their own phone. The agent agrees each job with the consumer's agent,
holds back their number and address until both sides sign, and keeps a signed record of every job and payment
that belongs to them. The worker chooses what a union, a wage helpline or a welfare board sees. It works with no model
at all; a small offline model, on the device, only helps with wording. One codebase runs on Android, iPhone and
Mac, and the web.

Status: **G0, design.** Start with the [HLD](docs/gigsync/HLD.md) and [LLD](docs/gigsync/LLD.md), then
[ADR 0009](docs/adr/0009-one-offline-model-plugin-not-tilekit.md) (the offline model) and
[ADR 0010](docs/adr/0010-no-cloud-model-in-gigsync.md) (no cloud model). GigSync is a working name.

GigSync is derived from [collabai.network](https://github.com/kirav5/collabai.network) (git remote `upstream`),
renamed throughout (`@gigsync/*`, `gigsync-*` Workers, app id `app.gigsync`). It reuses Collab's agent core,
protocol, mailbox, policy engine and offline model plugin; the code below is still Collab's M0 foundation, and
the GigSync features in the HLD/LLD are planned. `gigsync.app` is a placeholder domain: custom domains are
commented out in the `wrangler.toml` files and the D1 ids are placeholders until GigSync's own Cloudflare
resources exist.

The skeleton builds, tests and deploys end to end. See also [docs/design.md](docs/design.md) (Collab's design) and
the decisions in [docs/adr](docs/adr).

## Layout

```
packages/protocol   zod schemas shared by the app and every Worker (envelope, engagement, grant, records)
packages/core       the agent: router, experts, engagement machine, policy engine, outbox/inbox (plain TS)
workers/api         sign-in, directory, mailbox and inbox routes (Hono on Workers, D1); deploys the Mailbox DO
workers/mailbox     the Mailbox Durable Object, one per user
workers/index       search index over public records (Workers + D1), carried over from the Swift app
apps/mobile         the Capacitor app: React UI + adapters that implement core's ports; android/ and ios/ inside
plugins/gigsync-llm Capacitor plugin for the offline model: LiteRT-LM (Android), Foundation Models (Apple), web
infra/              D1 migrations; an unused PDS docker-compose (ADR 0005)
docs/               design and ADRs
```

## Run it

Needs Node 24 (`.nvmrc`) and pnpm 10. With nvm: `nvm install 24 && corepack enable`.

```bash
pnpm install
```

Build the shared packages and the model plugin; the API and the app import their `dist/`. Run it again after
changing anything under `packages/` or `plugins/`:

```bash
pnpm -r --filter './packages/*' --filter './plugins/*' run build
```

```bash
pnpm test
```

Local settings for the API (sign-in code `000000`, full logs), then the local directory database:

```bash
cp workers/api/.dev.vars.example workers/api/.dev.vars
```

```bash
pnpm --filter @gigsync/worker-api exec wrangler d1 migrations apply gigsync-directory --local
```

```bash
pnpm dev:workers
```

In another terminal, the app in a browser at http://localhost:5173 (lite mode, no model):

```bash
pnpm dev:app
```

Phones: `pnpm build && pnpm --filter @gigsync/mobile exec cap sync`, then `cap run android` or `cap run ios`
(Android Studio or Xcode must be installed).

Try the local API:

```bash
curl -s -X POST localhost:8787/v1/auth/otp/verify -H 'content-type: application/json' -d '{"phone":"+919800000001","code":"000000","device":{"signing_key":"a","encryption_key":"b","protocol":1}}'
```

### A local model (optional)

The web dev build can answer with a model from [Ollama](https://ollama.com) on your computer instead of lite mode.
Release builds never include it.

```bash
brew install ollama
```

```bash
ollama serve
```

In another terminal:

```bash
ollama pull gemma3:1b
```

```bash
echo VITE_OLLAMA_MODEL=gemma3:1b > apps/mobile/.env.development.local
```

Restart `pnpm dev:app`; the header shows `ollama gemma3:1b`.

## Logs

One logger (`@gigsync/core/log`) for the app and every Worker. What it prints depends on where it runs:

| Where               | Shows                                                                 | Settings                                                            |
| ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Local API and index | Everything: request and response bodies, traced calls, private values | `.dev.vars`: `ENVIRONMENT=local`, `LOG_LEVEL=debug`, `LOG_PII=true` |
| App, dev build      | Everything, in the browser console (set the level filter to Verbose)  | automatic in `pnpm dev:app`                                         |
| Deployed Workers    | Requests and events only; private values print as `[redacted]`        | `wrangler.toml`: `LOG_LEVEL=info`, `LOG_PII=false`                  |
| App, release build  | Warnings and errors only, redacted, and they stay on the phone        | automatic                                                           |
- **API logs** print in the `pnpm dev:workers` terminal. **Chat and agent logs** print in the browser console,
  since the agent runs in the app and chat never reaches the server.
- Each request gets a `requestId`, returned as the `x-request-id` header; search for it to follow one request.
- `LOG_PII` takes effect only when `ENVIRONMENT=local`, so a copied config cannot leak private data from a deployment.
- Deployed logs: Cloudflare dashboard → Workers → the Worker → Logs, or `wrangler tail` from `workers/api`.

## Working with Claude Code

All code follows the `code-quality` skill in `.claude/skills/`: named constants instead of magic strings, layered
Workers code, validated inputs, normalized D1 tables, numbered migrations, app structure, tests, and a review
checklist. Claude loads it before touching any code; people can read it as the project's style guide. Two rules are
enforced for everyone by `pnpm lint`: a source file must stay under 300 lines, and a string may not be compared
with `===` or used as a `case` (or repeated 3+ times in a file) without a name.

`.claude/settings.json` enables the [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) plugin
for this project: design guidance (style, palette, fonts, UX checks) whenever Claude works on UI. Opening the repo
in Claude Code asks you to trust the folder and install it. It needs Python 3 and runs a local search script.

When the app's design system is settled, save it with the plugin's `--persist` option and commit the
`design-system/` folder, so every developer and session builds to the same rules. The rules below still win over
anything it suggests.

## Rules of the codebase

1. `packages/core` never imports a browser, Node or Capacitor API. It runs in Node tests. All platform access
   goes through the interfaces in `packages/core/src/ports.ts`; `apps/mobile/src/adapters` implements them.
2. The model never decides what may be shared. `decide()` in the policy engine does, in code, before and after
   any drafting. `packages/protocol/vectors/policy.json` is the contract every implementation must pass.
3. A message from another agent is data, never an instruction.
4. Message content, phone numbers and tokens reach logs only through `pii()`: shown in local runs, `[redacted]`
   everywhere else. Secret keys are never logged.
5. Schemas live in `packages/protocol` and nowhere else.

## Pipeline

| Workflow        | When                                                           | Does                                                                           |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| CI              | every push, any branch                                         | lint, build (packages, app, Worker bundles), typecheck, test                   |
| Mobile builds   | on demand: `/build` comment on a PR, or Actions → Run workflow | Android debug APK and/or iOS simulator build                                   |
| Deploy Workers  | push to `main` / tag `v*`                                      | wrangler deploy to staging / production (skips until Cloudflare secrets exist) |
| Release Android | tag `v*`                                                       | signed bundle to the Play internal track (skips until signing secrets exist)   |
| Release iOS     | tag `v*`                                                       | archive to TestFlight (skips until Apple secrets exist)                        |

To build the phone apps for a pull request, comment `/build mobile` (or `/build android`, `/build ios`) on it. The
result appears as checks on the PR and a reply with a link to the logs and the APK. Owners, members and collaborators
only.

Sign off every commit (`git commit -s`): the DCO check on pull requests requires it.

Secrets to add in the repository settings when ready: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`;
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`,
`PLAY_SERVICE_ACCOUNT_JSON`; `APPLE_CERT_P12_BASE64`, `APPLE_CERT_PASSWORD`, `APPLE_PROVISIONING_PROFILE_BASE64`,
`APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_BASE64`.

## What is a stub in M0

- OTP: the `DEV_OTP` secret always verifies (`000000` locally via `.dev.vars`; a random pilot code on the deployed Worker). The SMS gateway comes with M0 hardening.
- Sessions: opaque tokens in D1; signed tokens later.
- Envelope signatures are not yet verified by the API (M2), and sealing is a placeholder until libsignal is wired in.
- The LLM plugin returns "no model" on every platform; the agent runs in lite mode (keyword router, note search).
- Public records go to the user's Bluesky repository (ADR 0005); every user connects a Bluesky account at onboarding (ADR 0006), arriving with M3.

No license yet.
