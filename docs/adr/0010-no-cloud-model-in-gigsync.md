# ADR 0010: No cloud model in GigSync

Date: 2026-10-25. Status: proposed. This ADR amends the sanitize ADR ([ADR 0008](0008-sanitize-in-code-then-local-model.md))
for GigSync.

## Decision

GigSync keeps the sanitize ADR's detectors in code on the phone, and changes where they run
(ADR 0015):
1. The worker's own data stays raw on the phone, and the offline model may read it when answering the worker.
2. When another agent is involved, the model sees placeholders; an edge check gates everything that leaves.

GigSync has no cloud step at all. No frontier or cloud model is used anywhere in GigSync:
- **Phone:** speech, translation and phrasing run on the phone. The keyword router and templates cover every path
  when no model is installed.
- **Union mode and web:** the same offline model plugin (ADR 0009), or templates when the device has none.
- **Inference Worker:** GigSync does not deploy it.

## Why

- **Workers' data:** the data is about some of the least powerful workers in the market, and harassment notes and
  pay disputes are the most sensitive data the product holds. They should not reach a third-party model, even with
  consent.
- **Fit with Mozilla:** the call excludes projects whose core depends on a frontier model. Ours depends on none.
- **Cost and offline use:** a ₹10,000 phone on patchy 4G is the target. A cloud round trip would be slower than the
  on-phone template path for most messages.
