# 0069: Sign-in codes by WhatsApp

Date: 2026-11-17. Status: proposed.

## Context

Sign-in proves a phone number with a one-time code. Production has no real codes yet: Firebase phone sign-in is not set
up (`FIREBASE_PROJECT_ID` is empty), so only the fixed `DEV_OTP` signs in, and anyone who knows it can sign in as any
number. The people GigSync serves live on WhatsApp, and a WhatsApp code needs no TRAI DLT registration, as a direct
SMS gateway would. Firebase cannot send WhatsApp messages, so the API has to make, send and check these codes itself.

## Decision

1. **The API sends the code** through Meta's WhatsApp Cloud API, in an approved "authentication" template whose body
   and Copy code button carry the code (`workers/api/src/auth/whatsapp.ts`). It is on when the `WHATSAPP_TOKEN` secret,
   `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TEMPLATE` are all set; setup is in `docs/setup/whatsapp-otp.md`.
2. **Same routes, same app path.** `POST /v1/auth/otp/request` makes a six-digit code, keeps it and sends it, and
   answers `{ sent, channel: "whatsapp" }`; `POST /v1/auth/otp/verify` checks it. The app already calls these when it
   has no Firebase, and now says "Code from WhatsApp" when that is how the code came.
3. **Only a hash is kept**: `otp_codes` holds one pending code per number as an HMAC tied to the number's own hash,
   for five minutes, deleted once it signs in. A new send replaces the code before.
4. **Every send is paid for, so sends are capped**: per client IP (`OTP_RATE_LIMIT`), one per number per 30 seconds
   (the app's Send again waits the same), and five per number per hour. Wrong codes keep the existing lockout (five
   per number per 15 minutes).
5. **With WhatsApp on, the dev code no longer signs in**, so a `DEV_OTP` left on a deployment is not a way in.
6. **Firebase SMS is unchanged**: a build with Firebase set up still sends its own SMS and signs in with the ID token.

## Consequences

- A number without WhatsApp gets no code: Meta accepts the send and fails it later. Until there is an SMS fallback,
  such a person cannot sign in. A fallback (Firebase SMS when Meta's delivery webhook says it failed, or a "Send by
  SMS" choice) is follow-up work.
- Each code costs a Meta authentication message (a fraction of a rupee in India).
- **Meta business verification is a prerequisite**: Meta creates Authentication templates only for verified
  businesses (tried 2026-11-18 on an unverified one: "does not have permission to create message template"). Until
  then this stays off, and sign-in is Firebase SMS (10 free a day, then about $0.07 each in India) or the dev code.
- The second-number check in the Aadhaar flow (`/v1/phone/confirm`) still uses the dev code or Firebase; moving it to
  WhatsApp can reuse `otp_codes`.
