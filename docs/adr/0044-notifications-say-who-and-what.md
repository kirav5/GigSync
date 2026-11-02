# ADR 0044: Notifications say who and what, encrypted to the phone

Date: 2026-11-02. Status: accepted. Amends [ADR 0043](0043-job-alerts-empty-web-push.md) §1 (pushes were empty).

## Context

The first real alerts said only "Your job has an update. Open GigSync to see it." The founders found that unhelpful:
a household waiting for a worker could not tell "on the way" from "cancelled" without opening the app, and the
setting's name, "Job alerts", read as jargon. They asked for the alert to say what happened, for it to be on unless
the owner says no, and for it to be called "Notifications".

The API cannot say more than it knows: job messages are sealed end to end (ADR 0010), so it sees only each envelope's
kind and sender. A household has no name on the server (only listed workers do), so the server cannot name the sender
either.

## Decision

1. **A push carries the kind of message and the sender's user id, nothing else** (`PushNews`), encrypted to the
   phone's own push keys with Web Push message encryption (RFC 8291, `workers/api/src/push/encrypt.ts`, WebCrypto
   only). The push service carries bytes it cannot read, so Google, Apple and Mozilla learn no more than before
   (that a push went to a device).
2. **The phone names the sender.** The app gives its service worker the names of the people this owner has jobs
   with; the notification's title is that name (or "GigSync" for someone the phone does not know yet, such as a
   first request) and its body says what happened, in the owner's language ("Signed the deal", "Asked for
   payment"). Amounts and notes never appear: the server never has them.
3. **The phone keeps the whole subscription.** It sends its push keys with its address (`PushSubscribe.keys`); the
   API keeps them in the same `devices.push_token` column, as JSON, so no migration. A device that gave no keys (an
   app from before this ADR) still gets an empty push and the plain line, until it next opens and sends them.
4. **On unless the owner says no.** A page may ask for notifications only from a tap, so the browser asks once, the
   first time the owner does something that starts a job's news: asks workers, publishes a card, signs, or sends an
   update. It never asks again on its own; Settings › Notifications still turns them on or off.

## Consequences

- An update still cannot say which update (on the way or running late): the code is inside the sealed body. Saying
  it would mean the service worker opening the message itself, which needs the device's keys and the mailbox in the
  worker; a later choice.
- A notification from someone the phone has never had a job with (a first request) has no name. Reading the board's
  display name for listed workers would cover some of those; not done, to keep one rule (names come from the phone).
- Chrome shows a quieter prompt to sites whose prompts are often refused, which is why the ask waits for a moment
  that has news coming rather than the first screen.
