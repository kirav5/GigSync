# ADR 0043: Job alerts are empty Web Pushes; a restored job ends through the record

Date: 2026-11-01. Status: accepted. Replaces the FCM wake-up planned in the mail route (`TODO(M2)`); amends
[ADR 0038](0038-job-records-on-the-server.md) §4 (a restored job is shown but nothing is sent on it).

## Context

Both apps learned of the other side's moves only while open, by polling the mailbox every two seconds: a household
was not told the worker was on the way, a worker not told they were paid. In a test on 2026-11-01 the household's card
said "On the way" while the worker's phone, which had lost its jobs and rebuilt them from the record on sign-in, said
"Agreed" and offered no action at all: a restored job could not send anything, because its messages and counters
never reached the server, so neither side could finish the job.

## Decision

1. **Alerts are Web Push, and the push is empty.** With the owner's yes (Settings › Job alerts), a device subscribes
   with the API's public VAPID key and gives the API its push address (`PUT /v1/devices/me/push`, kept in the
   existing `devices.push_token`). When a job message a person should hear about lands in their mailbox (a request, a
   question, a deal to sign or signed, on the way, done, paid, rated, cancelled, a problem, mentor and colleague notes;
   never the agents' own quotes and counters), the API sends each of their devices a push with **no payload**, signed
   with VAPID (`workers/api/src/push/webpush.ts`, WebCrypto only). The service worker shows "Your job has an update" in
   the owner's language, unless the app is on screen. Nothing about a job passes through Google's, Apple's or Mozilla's
   push service, so ADR 0010's line holds for alerts too.
2. **Only the big push services.** The API accepts and sends to addresses on FCM, Mozilla's, Apple's and Windows'
   push services only (`PUSH_HOSTS`), so it never sends a request to an address of anyone's choosing.
3. **iPhones** take pushes only in the app added to the Home Screen (iOS 16.4+); Settings says so instead of offering a
   switch that cannot work.
4. **A restored job ends through the record.** Its card offers Mark done (worker) or The work is done (household),
   and Cancel after a second tap. The move is saved on the phone and reported to the record by the records runner like
   any outcome; the other phone reads the record every minute and when the app comes to the front, and moves its own
   copy forward (`records/follow.ts`). Only forward: the record never moves a job back.
5. **Both apps draw the same progress line** (agreed, on the way, done, paid, closed, or where it was cancelled), each
   step with when the phone saw it: jobs now keep a history of their statuses and timed notes.

## Consequences

- Alerts need the VAPID pair set on the Worker: `node scripts/vapid-keys.mjs`, the public key and a contact as
  `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` vars, the private key by `wrangler secret put VAPID_PRIVATE_KEY`. Until both
  halves are set, the API offers no key and Settings says alerts are not switched on yet.
- An alert cannot say what happened, only that something did. Saying more would mean encrypting a payload to each
  device's push keys; that is a later choice, and would still keep the job's words off the push service.
- A dead push address is not cleaned up when the push service reports it gone (the request's database connection has
  closed by then); the app sends its current address on every open, which replaces it.
- A restored job still cannot carry payments or ratings through messages: the record holds only the outcome. Moving
  to a new phone by QR (ADR 0037) keeps the whole thread and remains the way to change phones.
- Not yet tested on a real phone: delivery through FCM and Apple's service, and how fast the record follow feels.
