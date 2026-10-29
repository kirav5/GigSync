# ADR 0028: Workers link as colleagues only in person, by a one-time QR code, and may then message each other

Date: 2026-10-29. Status: accepted. Narrows [ADR 0017](https://github.com/kirav5/GigSync/pull/8) (union-run circles,
proposed on the research branch) to its smallest safe piece; circles stay for when a union partner runs them.

## Context

The founders asked for worker-to-worker contact: passing on a job, and peer support. A worker-to-worker social layer
invites spam, poaching of customers and unwanted contact, which is a safety risk for women domestic workers. Circles
(ADR 0017) need a steward and a union desk that do not exist yet. The user chose "colleague chat only" for this round.

## Decision

1. **Linking is in person.** One worker shows a QR code (`gigsync:colleague?u=<user>&c=<code>&n=<name>`); the other
   scans it and confirms. The code is 16 random bytes, single use, valid ten minutes (`LINK_CODE_TTL_MS`), and kept
   only on the phone that showed it. The scanner sends `colleague {step: ask, code, card}`; the shower's phone answers
   `ok` with its own card only for a valid unused code, and ignores anything else silently, so probing learns nothing.
2. **There is no directory and no search for colleagues.** Nothing on the server knows who is linked to whom; the link
   lives on the two phones. Messages travel as sealed `colleague_note` envelopes on the pair's own channel id.
3. **Notes are accepted only from a linked colleague on that colleague's channel.** Either side can unlink (`end`),
   which deletes the link and its notes on both phones. Notes show in the reader's language through the same
   on-phone translation as job notes; the private-text check for jobs is not applied, since the two met in person.
4. **No groups, no forwarding, no warnings naming customers.** Those wait for a union-run design (ADR 0017).
5. **A colleague card is name, trades (≤ 5) and languages (≤ 5).** No phone number, rate or address moves at linking.

## Consequences

- Protocol: `colleague` and `colleague_note` kinds, `COLLEAGUE_KINDS` (never seen by the engagement machine),
  `ColleagueCard`, `ColleagueLink`, `ColleagueNote` (≤ `COLLEAGUE_NOTE_MAX` = 300 characters), `LinkInvite`.
- Core: `packages/core/src/colleague/` (`Colleagues` on `GigDevice`); the inbox gives up a gap once the envelope held
  behind it has expired, because a colleague channel can live for months.
- App: a Colleagues screen under Profile (show code, scan with the camera, threads, unlink) and an unread dot on the
  Profile tab. The camera needs `CAMERA` on Android and `NSCameraUsageDescription` on iPhone, with an explanation in
  the app's language before the phone's own prompt.
- A scanner cannot tell that a code has expired (the QR carries no time): its colleague stays "waiting" until the
  owner cancels it. A worker who reinstalls must scan their colleague's code rather than show their own.
