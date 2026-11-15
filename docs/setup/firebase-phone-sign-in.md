# Firebase phone sign-in: real SMS codes

GigSync signs people in with a six-digit code sent by SMS. Firebase phone authentication sends the SMS and checks the
code; the API then checks the ID token Firebase gives the app (`POST /v1/auth/phone/verify`) and signs the device in
exactly as before. Until this is set up, the app and the API use the fixed dev code (`DEV_OTP`), so nothing changes
locally or in the UI tests.

## Cost

Phone sign-in runs on Google Identity Platform: the first 10 SMS a day are free; after that Google charges per SMS, at
a rate that depends on the country (India included). Check the current rate on Google's pricing page
(<https://cloud.google.com/identity-platform/pricing>) before the pilot grows, and set a budget alert in Google Cloud.
SMS beyond the free tier need billing (the Blaze plan) on the project.

## What the owner does once

1. **Create the project.** In the [Firebase console](https://console.firebase.google.com), add a project (for example
   `gigsync`). Google Analytics is not needed. Note the **project id**.
2. **Enable phone sign-in.** Build → Authentication → Get started → Sign-in method → Phone → Enable. Under Settings →
   SMS region policy, allow India (and any other country the pilot serves) and deny the rest, which stops SMS fraud to
   expensive destinations.
3. **Add a web app.** Project settings → General → Your apps → Web (`</>`). Firebase shows a config with `apiKey`,
   `authDomain`, `projectId` and `appId`. These are public (they ship in every Firebase web app); nothing here is
   secret.
4. **Authorise the app's domains.** Authentication → Settings → Authorized domains. `localhost` is there already. Add:
   - `gigsync.network` and `www.gigsync.network` (the web app, `apps/mobile/wrangler.toml`);
   - `gigsync-app.<account>.workers.dev` if the app is opened from its workers.dev address.
5. **Optional: test numbers.** Authentication → Sign-in method → Phone → Phone numbers for testing. Add a number and
   a fixed code (for example `+91 98110 00000` / `123456`). These sign in without sending an SMS and cost nothing;
   use them for demos and manual testing. Never use a real person's number.

## Settings to set

**App build** (Vite reads these at build time; all four or none):

| Variable                    | Value                  |
| --------------------------- | ---------------------- |
| `VITE_FIREBASE_API_KEY`     | the web app's `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | its `authDomain`       |
| `VITE_FIREBASE_PROJECT_ID`  | its `projectId`        |
| `VITE_FIREBASE_APP_ID`      | its `appId`            |
- CI (deploy and both store releases): add GitHub **repository variables** `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`,
  `FIREBASE_PROJECT_ID` and `FIREBASE_APP_ID` (Settings → Secrets and variables → Actions → Variables). The
  workflows pass them to the build.
- Locally: put the four `VITE_FIREBASE_*` lines in `apps/mobile/.env.local` (gitignored). Leave them out to keep the
  dev code.

**API Worker:**
- `FIREBASE_PROJECT_ID` in `[vars]` in `workers/api/wrangler.toml`: the same project id. It is public, so it is a var,
  not a secret. Empty means `/v1/auth/phone/verify` answers 503 ("phone sign-in not set up").
- Locally: `FIREBASE_PROJECT_ID=<project id>` in `workers/api/.dev.vars`.
- Keep `DEV_OTP` unset on the deployed Worker once real codes work (`wrangler secret delete DEV_OTP`), so the fixed
  code no longer signs anyone in.

## How it fits together

- The app (`apps/mobile/src/adapters/phoneCode.ts`) loads Firebase only when a code is first sent, runs an invisible
  reCAPTCHA (Firebase needs it before it sends an SMS), and keeps Firebase's session in memory only. Sending again
  replaces the previous code.
- The API (`workers/api/src/auth/firebase.ts`) checks the token without Firebase's SDK: an RS256 signature by one of
  Google's published keys (cached for as long as Google's Cache-Control says), issuer and audience for this project,
  expiry, issue and sign-in times, a user id, and an E.164 `phone_number`. It then applies the same per-IP cap,
  per-number lockout and sign-in as the dev code path. The number is kept only as its HMAC, as before.
- The iPhone and Android apps load the web app inside a Capacitor webview (`capacitor://localhost`,
  `https://localhost`). Check phone sign-in on both before release: if reCAPTCHA does not run in the iPhone webview,
  the native Firebase plugin is the fallback.
