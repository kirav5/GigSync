# ADR 0067: The Android app's alerts come through FCM, generic and empty

Date: 2026-11-17. Status: proposed (asked for by the founders: "FCM implementation is done right?"). Builds on
[ADR 0043](0043-job-alerts-empty-web-push.md) and [ADR 0044](0044-notifications-say-who-and-what.md); does not change the web
app's alerts.

## Context

ADR 0043 gave the web app alerts by Web Push. The installed Android app (Capacitor) has no service worker, so
`adapters/push.ts` skips it: a worker with the app closed is never told a request came, and only learns of it on
opening the app. The phone must answer a request quickly for the agents to agree, so this is the worker's most
important alert.

A native app is woken through Firebase Cloud Messaging (FCM). Two kinds of message exist: a _data_ message, which only
reaches the app's code while it runs (with Capacitor, a closed app never sees it), and a _notification_ message, which
Android itself shows in the tray, app running or not.

## Decision

1. **A notification message, with no data.** When a job message a person should hear about lands in their mailbox
   (the same `WAKE_KINDS` as Web Push), the API sends each of their Android devices an FCM notification whose title
   is "GigSync" and whose body is one fixed line in the owner's language ("You have something new. Open the app to
   see it."). Nothing else: no kind, no sender, no job. Google learns only that this phone got a GigSync alert, which
   it already learns from a Web Push address on FCM. The web app's alerts stay as ADR 0044 made them, encrypted and
   saying what came, because a service worker can decrypt; a closed native app cannot.
2. **One tray line.** Every alert carries the same tag, so a burst of messages shows as one line, not five; it goes
   on Android's "Job alerts" channel at high priority, and the push service keeps it a day for a phone that is off.
3. **The token rides with the owner's language.** The app registers with FCM after the owner's yes and sends
   `{ fcm, lang }` to `PUT /v1/devices/me/push`, the same route and the same `devices.push_token` column as a Web Push
   address (kept as JSON). It sends it again on every open and whenever FCM gives a new token. Off is `DELETE` as
   before. No migration.
4. **The API signs in to FCM with a service account.** `FCM_SERVICE_ACCOUNT` (a Worker secret, the JSON Google gives)
   holds the project, the account and its private key; the API signs a short token with it (RS256, WebCrypto), trades
   it at Google for an access token, keeps that until it nearly expires, and posts to FCM's HTTP v1 API. Without the
   secret no native alert is sent and Web Push works alone; without the VAPID keys, native alerts work alone.
5. **Open means sync.** An alert that arrives while the app is open runs a sync at once; tapping one opens the app,
   which syncs as it comes to the front.

## Consequences

- The native alert cannot say what happened. Saying more would need native Android code that decrypts a data message
  and builds the notification itself, with the names the app keeps; that is a later choice.
- The founder sets it up once: a Firebase project with the Android app (`app.gigsync`), its `google-services.json` in
  `apps/mobile/android/app/` (not committed), and a service-account key as `wrangler secret put FCM_SERVICE_ACCOUNT`
  (`docs/setup/fcm-native-push.md`). A build without `google-services.json` still builds and simply never registers.
- A token FCM calls unregistered is not removed at once, as with Web Push: the app sends its current token on every
  open, which replaces it.
- iPhone apps are not covered: they would need APNs through Firebase and an Apple key. The iPhone web app keeps Web
  Push from the Home Screen.
- Not yet tested on a real phone.
