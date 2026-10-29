# ADR 0031: No colleagues; mentor links are the only worker-to-worker contact, and introductions need a signed job or a link

Date: 2026-10-29. Status: accepted. Supersedes [ADR 0028](0028-colleagues-linked-in-person.md) (colleagues linked in
person) and [ADR 0029](0029-workers-hire-and-refer.md) points 1 and 3 (hiring a helper, referrals). Point 2 of ADR 0029
(a provider never releases an address) stands.

## Context

The founders decided GigSync does not need a colleagues feature: no QR pairing, no colleague list, no hiring a helper
and no passing on a job. Workers moving city still need people who know the city, which the mentor flow covers
(mentors without a union gate, record-based, with expiring contact, block and report). Mentor links reused the
colleague channel, notes, translation, renewal and expiry, and mentor introductions rested on "people I already know",
which until now meant QR colleagues.

## Decision

1. **Removed:** QR pairing and the camera permission, the colleague list and screens, hiring a helper (Talk's "Hire
   someone" and `hireIntent`), referrals on a declined request, and their strings in en, hi and kn.
2. **Kept, as mentor links:** the link channel, notes both ways with translation, renew, expiry, end and block, now
   under `packages/core/src/mentor/`. Storage keeps the old collection names so links already on a phone still read.
3. **Who an owner knows:** someone they have a job with that both sides signed, or a mentor link with (live or ended),
   and not blocked. An owner may introduce two people only when they know both; a phone accepts an introduction only
   from someone it knows. "Do you know someone in {city}?" can be asked on a mentor link or on a finished signed job.
4. **Compatibility:** the `colleague`, `colleague_note` and `referral` kinds stay in the protocol so older phones'
   envelopes still parse; the app sends only what mentor links need and drops the rest on receipt.

## Consequences

- Introductions are rarer than with QR colleagues: a newcomer's first contacts come from browsing record-based mentors,
  then from the people they work with.
- A household that hired two workers can introduce them to each other, which is how most domestic workers find work
  in practice.
- Hiring a helper is dropped too: Today's "You hired" and Passbook's "Paid to helpers" are gone. A job hired for on an
  earlier build shows among the worker's other jobs on Today.
