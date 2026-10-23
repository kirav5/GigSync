# ADR 0007: Sanitize in code, then the local model, then Gemini

Date: 2026-10-23. Status: accepted. Replaces the design page 0.3 wording that put redaction in the Inference Worker.

## Decision

Every text a model reads goes through three steps, always in this order:
1. **Sanitizer**: plain code in `@collab/core` (`packages/core/src/pii`), on the phone, even in lite mode. Patterns
   and checksums find phone numbers, emails, Aadhaar, PAN, passport, driving licence, voter ID, UPI ids, card numbers,
   IFSC codes and addresses with a PIN code, and swap each for a numbered placeholder (`AADHAAR_1`). The real values
   are saved in the encrypted DB as high-sensitivity, device-only facts. It runs on what the owner types and on every
   message that arrives from another agent.
2. **Local model**: on the phone. Reads only the sanitized text. Routes, extracts and drafts, and marks what code
   cannot recognise (names, free-form addresses, amounts, health, relationships).
3. **Gemini**: through the Inference Worker, only with consent and only when everything it would read is
   cloud-assisted.

Real values go back in on the phone after the last model call, just before something is shown to the owner or sealed
for a contact. All redaction happens on the phone. The Inference Worker runs the same detector again and refuses a
request if it finds anything; it never redacts.

## Why

- Code first: predictable, covered by fixed test vectors, works with no model, and a prompt injection cannot talk it
  out of its job. It follows the rule that the model never decides what may be shared.
- Before the local model, not only before the cloud: a model that never holds a raw id cannot copy one into a draft,
  a log, a reply to another agent or a cloud prompt.
- The local model second: it covers what patterns cannot.
- Gemini last: it is the only step that leaves the phone.
- Redaction on the phone only: if the Worker redacted, raw text would already have left the phone.

## Consequences

- Placeholders must be numbered, stable within one request and reversible on the phone. `redactPii()` today writes
  one `[REDACTED]` marker for everything and must change before step 3 is wired. The agent does not call the
  sanitizer yet.
- The compute label is taken over what a model actually reads: a device-only value replaced by a placeholder no
  longer forces the phone; a device-only item left as text still does.
- Lite mode has no step 2, so names would reach Gemini unreplaced. Whether cloud AI is allowed in lite mode is open
  (design page, open decision 8).
- Hosted worker agents run the same sanitizer inside their Durable Object before calling Gemini.
