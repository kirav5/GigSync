# ADR 0023: Speech to text on the phone first; a cloud recognizer only after the owner allows that company

Date: 2026-10-29. Status: accepted. Amends [ADR 0010](0010-no-cloud-model-in-gigsync.md) ("speech, translation
and phrasing run on the phone") for speech to text only. Replaces the "on-device speech only" decision planned in
the UI rework.

## Context

The UI rework puts a mic in the Talk composer and builds the worker's card by a spoken interview. On-device speech to
text exists in far fewer places than the pilot needs:
- **Android:** `createOnDeviceSpeechRecognizer` from API 31. Hindi is likely, Kannada is undocumented and has to be
  checked on each phone, and some phones ship no on-device recognizer at all.
- **iPhone:** `SFSpeechRecognizer` on device for English; Hindi only on Apple's servers; Kannada not supported.
- **Desktop Chrome 139+:** `processLocally` for English and Hindi after a pack install; no Kannada.
- **Phone browsers:** none.

An on-device-only rule would make the mic say "please type" to most Kannada speakers, to every iPhone Hindi speaker
and in every phone browser. The owner decided: "if there is no other alternative for voice, then use the same we did
in the Collab web project", which used the browser's own recognizer (audio to Google in Chrome, Apple in Safari).

## Decision

1. **Order everywhere:** the on-device recognizer when it is available for the language; otherwise the platform's
   cloud recognizer, but only after a one-time consent for that company; otherwise typing and the tap choices that
   every interview question already shows.
2. **The plugin cannot reach the cloud by accident.** `@gigsync/plugin-speech`'s `listen()` takes
   `allowCloud` (default false) and rejects with `unavailable` without it. The app's adapter
   (`apps/mobile/src/adapters/speech.ts`) passes it only when the device has no ready engine and the owner has
   allowed that vendor.
3. **Consent is per company and stored once.** The first time a listen would go to a cloud recognizer, the Composer
   shows a sheet (not a browser `confirm`): `speech.cloud_ask` names the language and the company; "Allow" stores the
   vendor under the Preferences key `speech:cloud-consent`; "I'll type" stores nothing and focuses the field, so the
   next tap asks again. Profile's Voice section shows `speech.cloud_on` and a `speech.cloud_withdraw` button.
4. **The company named is the company that hears the audio.**
   - Android binds the cloud path to Google's own recognizer service (the Google app or Speech Services by Google) by
     package name, not to the phone's default service, so "Google" on the sheet is true. With neither installed, no
     cloud is offered.
   - iPhone uses `SFSpeechRecognizer` with `requiresOnDeviceRecognition = false` only when the locale is in
     `supportedLocales()`; the vendor is Apple. Every browser on iPhone also reports Apple.
   - Desktop and Android Chrome report Google. Edge, Opera, Samsung Internet and Yandex report "your browser's
     company": Edge's recognizer is Microsoft's, and naming Google there would be false. This departs from the
     amendment's "Chrome or Edge means Google".
   - A `service-not-allowed` error (an iPhone home-screen app) marks the language unavailable for the session.
5. **Reading aloud stays local.** Text to speech uses only voices that need no network, because agent replies can be
   private. A language with no local voice shows no speaker button.
6. **Honest text.** `speech.about` is true in both cases; Profile says which engine is used and whether the voice
   stays on the phone (`speech.where_device`) or goes to the company (`speech.where_cloud`). The iPhone permission
   strings say the same in English: "GigSync listens only while you tap the mic." and "Your speech is turned into
   text on this phone when it can. If it can't, and only after you allow it, Apple turns it into text."
7. **Tests never need a real recognizer.** In development only (`import.meta.env.DEV`), `localStorage`
   `gigsync-fake-speech` scripts what the mic hears and `gigsync-fake-speech-mode` (`cloud`, `none`) picks the
   engine state, so the UI tests can drive the consent sheet. Release builds leave the fake out; the lead greps the
   built `dist` for it.

## Why

- A mic that silently fails is worse than no mic, and a mic that only says "please type" fails the low-literacy
  workers the interview is for.
- Consent per company, asked in the owner's language at the moment it matters, is a choice the owner can make and
  take back; a hidden fallback is not.
- Speech to text of a card interview carries trades, areas and rates the worker is about to publish anyway, with one
  exception: the lowest rate, which never leaves the phone. That one question listens only on the device, and with
  only a company's recognizer the mic asks for it to be typed (`speech.type_private`), so "Nobody else sees this"
  stays true. Its readback is spoken only when the owner said the amount aloud; typed, it is shown and never spoken.
  Private notes typed or spoken in Talk can go to the vendor once allowed; the sheet says so plainly instead of
  promising otherwise.
- Consent belongs to the owner who gave it: signing out clears it, so the next person on a shared phone is asked.

## Consequences

- ADR 0010's "speech runs on the phone" now holds for reading aloud and for translation, and for speech to text
  only until the owner allows a company.
- Engine names reported by the plugin: `android-ondevice`, `apple-ondevice`, `chrome-ondevice`, `android-cloud`,
  `apple-cloud`, `browser-cloud` (listening); `android-ondevice`, `apple-ondevice`, `browser-ondevice` (speaking);
  `fake`, `fake-cloud` (development).
- Not verified on a device yet: live recognition, the permission prompts, Kannada support on pilot phones, and the
  Android 12 (API 31–32) path. Download state does not refresh by itself after a download starts.
- The Info.plist strings are English only; translating them is a follow-up.
- Phase 2: a bundled IndicConformer engine behind the same plugin API would give Kannada everywhere, Hindi on iPhone
  and voice in phone browsers without any cloud, after which the cloud path can be retired.
