# ADR 0045: One agent per job: the first of a worker's devices to claim a request answers it

Date: 2026-11-02. Status: accepted. Amends [ADR 0037](0037-server-held-record-earnings-and-moving-phones.md) (a
person may keep more than one device live) and the mail transport's "seal to every device".

## Context

A household seals each envelope to every device in the worker's directory listing (`mail/transport.ts`), so a worker
signed in on two live devices (a phone and a laptop, or an old phone kept after signing in on a new one with "Not
now") receives every request on both. Each device made a job from it and its agent answered: two clarifies or two
quotes on one engagement, then two counters. The household's phone applies the first and logs "envelope out of turn"
for the rest, so which device's quote counts depended on mailbox timing, and the worker's two devices disagreed about
the job. Re-reading a person's device list after a minute (PR #18) made a second device reachable in more cases, so the
gap would show more often.

## Decision

1. **Claim before answering.** When a request arrives for an engagement a worker's device does not have, the device
   claims the engagement in its owner's own mailbox (`POST /v1/inbox/claims`, the `Mailbox` Durable Object's
   `claim`). The first claim wins and is kept for as long as a job's envelopes live (`DEFAULT_TTL_SECONDS.job`); every
   later claim is told which device holds it. A Durable Object runs one call at a time, so two devices claiming at once
   cannot both win.
2. **The device that wins negotiates the whole job.** Its agent clarifies, quotes, counters and asks its owner to sign,
   as before. Nothing else changes for a worker with one device, beyond one small call per request.
3. **The device that loses only shows the request.** It saves the job marked `elsewhere` (the winning device), never
   lets its agent answer, and its card says "Your other phone is answering this request" with no actions. It follows
   one later envelope: the household calling the request off. Every other envelope on that engagement is skipped; its
   own moves never happened there, so they would be out of turn.
4. **A failed claim answers.** The request was just fetched from the same mailbox, so a claim rarely fails. If it does,
   the device answers: a request nobody answers is worse than a second quote the household's phone drops.

## Alternatives rejected

- **Only the most recently active device runs the agent.** Needs every device to report activity, and the rule is
  wrong exactly when it matters: a worker who last opened GigSync on a laptop, then closed it, would have requests
  claimed by a device that is not running, and nothing answers them. The first device to claim is, by construction, a
  device that is running.
- **The household's phone picks the first worker device to answer and drops the others.** Keeps the server out of it,
  but the losing device still negotiates, shows the worker a quote that was never seen, and keeps answering counters
  sealed to it.
- **Seal to one device only.** The household cannot know which of the worker's devices is in use, and an agent on a
  device that never received the request cannot be told about it later.

## Consequences

- The losing device does not mirror the negotiation. It does not see the winning device's quotes, the deal to sign,
  or the contacts, because a device's own envelopes are sealed only to the other party. A full mirror would mean
  sealing each sent envelope to the sender's other devices too, with a delivery into the sender's own mailbox; that is
  a later change. Until then the worker signs on the device that answered, and a signed job reaches the other device
  through the record (ADR 0038) only when that device has no jobs at all.
- Each device answers by its own rules. A device whose card came back from GigSync without the lowest price
  (`floor_missing`) waits for the worker before quoting, so if it wins the claim the request waits there even when the
  other device could have quoted at once. Still one negotiation; the browser test gives both devices the price.
- A request the household never calls off stays on the losing device as a new request with the "other phone" line.
- The mailbox learns which device answered which engagement. It already routes every envelope by engagement and
  sending device, so this adds nothing about the job's content.
- Households are not affected: only an incoming request makes a new job, and a household's own requests are created on
  the device that sent them.
