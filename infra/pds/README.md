# Collab PDS

The only server we run. It holds each user's public records in their own signed AT Protocol repository, so the
data is theirs and portable. The search index on Cloudflare D1 is a copy fed from this server's event stream
(`com.atproto.sync.subscribeRepos`) and can be rebuilt from it at any time.
- Host: a small VM in Mumbai (2 vCPU, 4 GB is plenty for the pilot). Daily backups of `./data` to R2.
- Accounts: created by the API Worker after OTP sign-in, handle `<name>.collabai.network`. Users never see a
  separate "AT Protocol account".
- Records: collections are defined in `packages/protocol/src/records.ts`.
- Not yet deployed. M3 brings it up.
