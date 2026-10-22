# Collab index on Cloudflare

The marketplace discovery index, serverless: nothing runs on your computer.
- **Same API as `collab-index`** on the Mac: `POST /query` (a listing filter) → signed listings; `POST /publish`
  (a signed listing) → `{"ok": true}`; `GET /health` → `{"listings": n}`. Point the app's index at the Worker URL.
- **Fed by AT Protocol:** a Durable Object follows Jetstream for `dev.collab.market.listing` records (verified sellers
  keep their listings in their own repo) and resumes from its cursor after a restart.
- **Push:** `GET /subscribe` (WebSocket) — send a filter once; newly indexed listings that match are pushed.
- Every listing is checked (NIP-01 id and Schnorr signature) before it's stored; buyers' apps check it again.

## Deploy (free tier is enough for a pilot)

```
npm install
npx wrangler login
npx wrangler d1 create collab-index        # copy the database_id into wrangler.toml
npm run db:init
npm run deploy
```

## Test locally (no account)

```
npm install
npm test
```
