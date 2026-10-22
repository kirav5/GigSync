# ADR 0006: Every user connects a Bluesky account at onboarding

Date: 2026-10-23. Status: accepted. Amends ADR 0005.

## Decision

Connecting a Bluesky account is part of sign-up, not a step deferred to the first publish. Right after OTP the app
opens Bluesky's OAuth flow (sign in, or create an account on bsky.social) and links the resulting DID to the Collab
user in the directory. Every Collab user therefore has an AT Protocol identity and a repo for public records from
day one. The user never needs the Bluesky app; the account is an identity, like "sign in with Google".

The Bluesky session (refresh token and DPoP key) is stored in the encrypted database and included in the encrypted
backup, so a reinstall that restores the backup also restores the session. Collab never sees or stores the Bluesky
password.

## Why

- Without a DID, a user's public records (listings, wanted, reviews, public notes) have nowhere to live, and the
  marketplace side of Collab does not work for them. A user without one is in an "incognito" state we do not want.
- Doing it once at onboarding is simpler to explain than a surprise prompt at the first publish.
- No server to run (ADR 0005 still holds); Bluesky hosts the repo and the repo signing key.

## Recovery

| Situation                  | What happens                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal use                 | The refresh token rolls over silently; no second login.                                                                                                                                   |
| Reinstall with backup      | OTP, then the PIN unlocks the backup; the DB, account key and Bluesky session come back. New device keys are certified by the account key.                                                |
| Reinstall without backup   | OTP, then "Continue with Bluesky" once more; the DID link in the directory is unchanged, so listings and reviews are intact. Private data is gone (new account key, safety code changes). |
| Bluesky password forgotten | Bluesky's own email reset; then one OAuth login. Nothing in Collab changes.                                                                                                               |
| Session revoked or expired | A "Reconnect Bluesky" card; one OAuth login. Publishing queues in the outbox meanwhile.                                                                                                   |
| Bluesky outage             | Publishing pauses; search, messages and everything private keep working.                                                                                                                  |

## Onboarding options considered

The user owns their repo on a PDS that is not ours (bsky.social today, any PDS later). Options, smoothest first:
1. **Combined sign-up (chosen).** OTP, then one screen "Create your public identity" that opens bsky.social sign-up
   in the system browser with the handle suggested and the email pre-filled, then CAPTCHA, then the OAuth consent,
   then back in Collab. Framed as an identity hosted by Bluesky, never as joining a social network.
2. **Defer to the first real action.** Searching and reading without a DID; the combined flow becomes mandatory at
   the first post, enquiry, application, saved search or rule. Kept as the fallback if drop-off at step 1 is high.
3. **Bring your own account.** A "Sign in with Bluesky" button beside the phone field for people who already have
   one: OAuth first, then OTP to bind the phone and keys. Added on top of option 1.
4. **Embedded sign-up.** Calling `createAccount` with an embedded hCaptcha so the user never leaves the app. Needs
   Bluesky's agreement for our OAuth client; investigate, fall back to option 1.
5. **Any-PDS choice.** A handle or PDS URL field under "more options", same OAuth code path.

We never create a bsky.social account on the user's behalf: it is gated by a browser CAPTCHA, counts as automated
sign-up under Bluesky's terms, and would leave us holding the password.

## Unverified or fake email

Bluesky creates the account as soon as the form and CAPTCHA pass. Publishing through OAuth works on an unverified
account; the email is only Bluesky's recovery channel (password reset, email change, 2FA). A fake address therefore
never blocks using Collab; it removes the safety net for a forgotten password.
- The encrypted backup (H8) holds the Bluesky session, so the password is needed only when the backup is also gone.
  First backup runs right after onboarding and a copy stays in Downloads.
- Right after sign-up the app offers to save the Bluesky password in the phone's own credential manager (the user's
  store, never ours). We do not store the password.
- One non-blocking "verify your email so you can recover your account" card after onboarding, repeated weekly until
  done, plus a Settings badge.
- **Replace my public identity**, for a stranded account: OTP, new Bluesky sign-up, the new DID linked to the same
  Collab user, the index tombstones records under the old DID, the user re-publishes. Contacts, grants and
  engagements are untouched (they hang off the Collab account key); reviews received under the old DID are lost and
  the app says so.

## Seeing your public data

- In Collab: My listings and Profile → Public identity read the repo directly (`listRecords`); Export downloads the
  whole repo as a CAR file (`com.atproto.sync.getRepo`).
- Outside Collab, no login needed because public records are public: any AT Protocol repo browser (pdsls.dev,
  atproto-browser) or the raw endpoint
  `https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=<did>&collection=network.collabai.listing`. The
  Bluesky app shows only its own record types, so Collab listings never appear as posts.
- Access to edit or withdraw depends on the session or password, never on the email; reading is open to everyone.

## Consequences

- Onboarding has one more screen; sign-up on bsky.social needs an email. Drop-off at this step must be measured in
  the pilot; if it is high, ADR 0003's own PDS (DID created by our API, no Bluesky) is the fallback.
- Public records sit on Bluesky's servers in the US under Bluesky's terms; private data is unaffected.
- Handles are `name.bsky.social`; `name.collabai.network` can be offered later through a Worker serving
  `/.well-known/atproto-did`.
- Private chats and notes are never written to the Bluesky repo under any setting; only records the user publishes.
