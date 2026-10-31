# ADR 0008: Sanitize in code, then the local model; nothing leaves the phone for a model

Date: 2026-10-23 (rewritten 2026-10-28). Status: accepted; where it runs is amended by ADR 0015 (raw private data on
the phone, checked at the edge) and the no-cloud rule is ADR 0010. Numbered 0007 until 27 Oct 2026.

## Decision

Every text a model reads goes through two steps, always in this order, and never a third:
1. **Sanitizer**: plain code in `@gigsync/core` (`packages/core/src/pii`), on the phone, even in lite mode. Patterns
   and checksums find phone numbers, emails, Aadhaar, PAN, passport, driving licence, voter ID, UPI ids, card numbers,
   IFSC codes and addresses with a PIN code, and swap each for a numbered placeholder (`AADHAAR_1`). The real values
   are saved in the encrypted store as high-sensitivity, device-only facts. It runs on every message that arrives from
   another agent and on every draft addressed to one.
2. **Local model**: on the phone, offline. Reads only the sanitized text. Routes, extracts and drafts, and marks what
   code cannot recognise (names, free-form addresses, amounts, health, relationships).

There is no cloud step. No text that a model reads ever leaves the phone, with or without consent (ADR 0010).

Real values go back in on the phone after the model call, just before something is shown to the owner or sealed for
a contact. All redaction happens on the phone.

## Why

- Code first: predictable, covered by fixed test vectors, works with no model, and a prompt injection cannot talk it
  out of its job. It follows the rule that the model never decides what may be shared.
- Before the local model: a model that never holds a raw id cannot copy one into a draft, a log or a reply to another
  agent.
- No cloud step: the worker's agent must work on a ₹10,000 phone with patchy 4G, and a worker's data is theirs; a
  cloud model would make GigSync the platform in the middle that the whole design refuses.

## Consequences

- Placeholders must be numbered, stable within one request and reversible on the phone. `redactPii()` today writes
  one `[REDACTED]` marker for everything and must change before the agent calls the sanitizer.
- Lite mode has no step 2 and needs no sanitizer for drafting: templates carry no free text from the other side.
- The detectors are reused by the edge check (ADR 0015), which gates everything that leaves the phone.
