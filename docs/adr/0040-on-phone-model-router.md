# ADR 0040: The phone's own model reads what the chat is asking; keyword lists only when it has none

Date: 2026-10-31. Status: accepted. Amends [LLD §3.5 and §8.4](../gigsync/LLD.md) (intent only "when the keyword
router is unsure"); keeps [ADR 0010](0010-no-cloud-model-in-gigsync.md) (no cloud model reads what owners type).

## Context

Every intent in Talk and Find is matched today by word lists: editing the card, offering to help newcomers, moving,
earnings, the city guide, then remember, find, ask or chat (`packages/core/src/router/*`, the chain in
`apps/mobile/src/screens/Agent.tsx`). The model router that `agent.ts` names as M1 was never built, so each round added
another list. Lists miss ordinary phrasings ("is ₹8,000 fair for a cook?") and the miss falls silently through to plain
chat. LLD §8.4's "model only when the keyword router is unsure" cannot help here: a list that misses does not know it
missed, it looks like a confident "chat".

A cloud model would read every owner, including the low-end phones that have no model of their own, but chat text
would then leave the phone. The founders chose that it does not.

## Decision

1. **One model router behind the existing `Router` interface**, covering every chat intent in one place: edit card,
   help newcomers (offer, stop), moving, earnings, market price, find, remember, ask self, ask contact, set rule, chat.
   The chain in `Agent.tsx` becomes one call that returns a route.
2. **The model only names the intent and fills its slots**, from a fixed list: trade, area, city, amount, contact,
   card field, note text. Its reply is JSON checked by a zod schema in core; slot values must be ones core knows (a
   trade or area from the lexicon, a contact the owner has, an amount that appears in the words). Code then runs the
   action and computes every number, as before (ADR 0033's rule).
3. **Model first when the phone has one.** Auto uses the phone's own engine (LiteRT-LM, Apple Foundation Models,
   Chrome's built-in model on desktop; Ollama in development builds) when Settings' rules say it is usable. The keyword
   lists answer when there is no usable model, when the model is slow past a time limit, or when its reply fails the
   schema or names a slot core does not know. Lite mode stays complete.
4. **Chat text never leaves the phone for routing.** No server or cloud fallback. ADR 0010 stands.
5. **The existing word lists stay as the fallback** and keep their tests; new intents add an enum value and a few
   prompt examples, plus fallback words only where lite mode must handle them.
6. **Measured, not assumed.** An eval set of phrasings in English, Hindi, Kannada and Hinglish (including the ones the
   lists miss) runs against the dev model and the keyword router, reporting accuracy per intent; the build reports both.

## Consequences

- Owners whose phones run a model are understood in their own words; the rest get today's behaviour, no worse.
- Budget Android phones, most of GigSync's workers, usually have no usable model and stay on the lists. Their misses
  are only reduced by better lists; this is the accepted cost of keeping chat text on the phone.
- A model call adds latency to each message on phones that have one; the time limit bounds it.
- Routing quality on real phones is unknown until the eval runs on test devices (LLD §8.5).
