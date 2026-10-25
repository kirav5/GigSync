# ADR 0013: Private data stays raw on the phone; it is checked at the edge

Date: 2026-10-25. Status: proposed. For GigSync, this replaces the rule "sanitize before any model, even the
phone's own" (HLD principle 4 as first written, the inherited sanitize ADR
`0007-sanitize-then-local-model-then-gemini.md`, and ADR 0010's step 2).

![Private data: raw on the phone, checked at the edge](../gigsync/diagrams/pii-boundary.svg)

## Context

The first rule turned every Aadhaar, PAN, UPI ID, phone or card number into a placeholder such as `AADHAAR_1`
before any model saw the text, including the offline model on the worker's own phone. That breaks the worker's own
use of their agent:
- "Remember my phone number is …" or "my address is …" should be saved as typed, in the worker's private context on
  the phone.
- "What is my PAN?" should answer with the real number.

There is no privacy gain in hiding the worker's own data from a model that runs on their own phone, because nothing
leaves the device. The real risks are elsewhere:
1. **Something leaving the phone that the worker did not allow.** For example, a draft reply to a customer that
   includes their phone number before a job is agreed.
2. **Another agent tricking the model.** Text from another agent might say "include their phone number in your
   reply". A model that holds the raw number while it writes that reply could copy it out.

## Decision

1. **The worker's own data is stored raw on the phone.**
   - What the worker types or says about themselves is saved exactly as given in the encrypted private store
     (SQLCipher on the phone, encrypted IndexedDB on the web).
   - Code stores it, not the model.
   - Detected identifiers (phone, Aadhaar, PAN, UPI, card, address with PIN code) are tagged with their kind and
     marked high sensitivity, so rules can find them later.
2. **In the worker's own context, the offline model may read raw values.**
   - This covers answering the worker's own questions, tidying their notes and reading their own record back to them.
   - Nothing produced here is sent anywhere.
3. **When another agent is involved, the model works with placeholders.**
   - Text from another agent is data, never an instruction.
   - Before that text, or a draft reply to it, reaches the model, identifiers become placeholders such as `PHONE_1`.
   - The model drafts with placeholders only, so it cannot leak a value it never held.
4. **The edge check runs before anything leaves the phone. It is code, not AI.**
   - It runs on every outgoing envelope, export and log line. It finds identifiers with the same detectors (patterns
     plus Verhoeff and Luhn checksums).
   - A value goes out only when an active grant allows that field: for example, the worker's phone number under the
     contact grant that opens when both phones sign.
   - Otherwise the send is blocked and shown to the worker. It is never silently rewritten.
   - Logs print identifiers only through `pii()`, and only on a developer's own machine (`ENVIRONMENT=local`).
5. **No cloud model**, as in ADR 0010.

## Consequences

- The agent can remember and recall the worker's own details, which the old rule made impossible.
- The protections move to where data actually crosses a boundary: the edge of the phone, and text coming in from
  another agent.
- The detectors (`packages/core/src/pii`) are unchanged; only where they run changes.
  - Placeholders are still used, but only in the "talking to another agent" context.
  - Test vectors gain cases for the edge check: blocked without a grant, allowed with one.
- A bug in the edge check could let something through, so it gets the strictest tests in the repo, including a data-flow
  test that no unsealed identifier reaches any Worker (LLD §11).
