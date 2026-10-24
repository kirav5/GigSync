# ADR 0010: No cloud model in GigSync

Date: 2026-10-25. Status: proposed. This ADR amends the sanitize ADR (`0007-sanitize-then-local-model-then-gemini.md`)
for GigSync.

## Decision

GigSync keeps steps 1 and 2 of the sanitize ADR:
1. The sanitizer runs in code on the phone.
2. The local model reads only sanitized text.

GigSync drops step 3, Gemini through the Inference Worker. No frontier or cloud model is used anywhere in GigSync:
- **Phone:** speech, translation and phrasing run on the phone. The keyword router and templates cover every path
  when no model is installed.
- **Desk:** a model runs only on the union's own machine, through Tiles and Tilekit (ADR 0009).
- **Inference Worker:** GigSync does not deploy it.

## Why

- **Workers' data:** the data is about some of the least powerful workers in the market, and harassment notes and
  pay disputes are the most sensitive data the product holds. They should not reach a third-party model, even with
  consent.
- **Fit with Mozilla:** the call excludes projects whose core depends on a frontier model. Ours depends on none.
- **Cost and offline use:** a ₹10,000 phone on patchy 4G is the target. A cloud round trip would be slower than the
  on-phone template path for most messages.
