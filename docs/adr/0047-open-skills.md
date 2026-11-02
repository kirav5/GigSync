# ADR 0047: Any skill on a card, any skill in a need

Date: 2026-11-02. Status: accepted. Amends [ADR 0041](0041-prices-from-drivers.md) (a need outside the trades can now
reach a worker), [ADR 0038](0038-job-records-on-the-server.md) §1 (a job record's work may be `other`) and the board
(LLD §7.5: a card lists trades and the worker's own skills).

## Context

A card could only list the eight `Trade`s, and Find could only search for them. A tailor, a gardener, a mehendi
artist or a tutor could not be on GigSync at all, and a household asking for one was told nobody offers it (ADR 0041's
outside path), even when such a worker was standing next door. The trades drive a lot: board search
(`worker_trades`), the card interview's trade question, Find's need interview, the worker's agent's standard
questions (`QUESTIONS` in `job/ask.ts`), the price drivers and estimates, the terms each trade negotiates, the keyword
and meaning routers' sayings, job records, and every screen that names the work (`trade.*` in en/hi/kn).

We considered making every one of those open: a free-text trade everywhere. It would leave the price drivers,
estimates, terms and records with nothing to key on, and turn every `Record<Trade, …>` into a lookup that can miss.
The trades are where GigSync has prices, questions and data; an open skill has none of that yet, and the design should
say so rather than pretend.

## Decision

1. **The trades stay canonical; one more kind of work, `other`, carries a skill.** `Trade` is unchanged and still
   drives every price question, estimate, term and router. A job's kind of work is `JobTrade` (`Trade` or `other`). A
   request for `other` carries a `Skill`: the worker's own words for the work as their card lists them (`text`), and
   the language they are in (`lang`). Every `Record<Trade, …>` that a job reads now handles `other` explicitly: no
   price drivers, no scope buckets, no estimate, the `when` term only, and the generic questions below.
2. **A typed skill is a known trade when it clearly is one.** Before a skill is kept, the phone reads the words with
   the card interview's trade lexicon (every trade's words and its name in en/hi/kn). "Bijli ka kaam" or "ಕುಕ್" becomes
   the trade, with its questions and estimates, and the worker or household is told so. Only words that name no trade
   are kept as the person's own skill, as typed, with the language tag of the app they typed it in.
3. **What a skill may say (moderation).** `SkillText` in `packages/protocol/src/skill.ts`, checked by the phone before
   publishing and by the server on every card it stores:
   - 2 to 40 characters and at most 4 words: a name for work, not a sentence;
   - letters and combining marks in any script, spaces, and `- ' & / .` only. No digits in any script, so no phone
     number, price or UPI id; no `@` or `:`, so no email or link;
   - not one of a short list of blocked words (sexual services, weapons, drugs) in English, Hindi, Kannada and their
     romanised forms; the list is in the same file, so phone and server refuse the same words.

   A card carries at most 3 skills, and at most 5 trades and skills together (`MAX_TRADES`). This stops the obvious,
   not a determined abuser: the real controls are that every card belongs to a phone-verified account that can be
   suspended (`users.status`), and that contact details are released only after both sides sign. Reporting a card is
   a follow-up.
4. **Searching a skill never sends the household's words anywhere.** The household's phone fetches the board's skill
   list, `GET /v1/board/skills`: the distinct skills on active cards, each with its key and how many workers list it,
   most-listed first, at most `MAX_SKILL_LIST` (500). It is public card data already. The phone matches the
   household's words against that list on the phone, by text (the skill's name inside the words, or within a letter or
   two of a run of them, as area names are matched) and, on a phone with the embedding model (ADR 0042), by meaning
   (the closest of the 100 most-listed skills at `SKILL_MIN_SIMILARITY` or more). That bar is the trades' 0.86,
   calibrated on trade sayings rather than skill names, so it errs towards no match; a miss leaves the need outside the
   list, as before. A need addressed to one worker (their QR) matches against that worker's skills only. It then searches the board with the matched skill's
   key, `GET /v1/board/workers?skill=…`, a key that is already on the public list. The server learns which listed
   skill was picked, as it learns the trade today; it never sees what the household typed or said, and no third party
   is involved: no hosted embedding, translation or search service sees any of it (ADR 0040 holds).
5. **One key per skill.** `skillKey` normalises a skill's text (Unicode NFKC, lower case, punctuation to spaces, one
   space between words). The server computes the key itself on publish (`worker_skills.skill_key`) and searches by it,
   so "Tailor", "tailor " and "TAILOR" are one skill. "Tailor", "darzi" and "ದರ್ಜಿ" stay three keys; the meaning match
   is what links them, and only on a phone with the model. That is a known gap, accepted for now.
6. **Generic questions, no estimate.** For `other`, the worker's agent asks `job` ("What exactly is the work?") and
   `duration` ("About how long will it take?"); Find asks the first up front, then where, when and the budget, as for
   any trade. There is no estimate and no city band: GigSync has no market data for a skill, and inventing a range
   would anchor both sides on a made-up number. The household sets its budget unaided (it stays on the phone, as
   always); the worker's agent quotes from the worker's own usual rate and lowest rate on their card, which is what
   `planFor` already did for a trade with no band. Find says plainly that there is no going rate for this work yet.
7. **Records keep no skill words.** A job of `other` is recorded on the server as `work: { trade: "other", scope: {} }`
   (ADR 0038's rule that records hold no free text stands), so it counts on the worker's record and stars like any
   job, but it is never read for an estimate. Estimates for a skill need its key on the record and enough jobs per key
   (the 10/10/10 rule); that is a later ADR, once a skill has the volume.
8. **Existing cards do not change.** Migration 0013 adds `worker_skills` only. `BoardProfile.skills` is optional: a
   card without skills is stored, served and searched exactly as before; the known trades behave as today. A card may
   now list no trade when it lists a skill, so `trades` may be empty.
9. **No new device protocol number.** Only a phone on this build can list a skill or ask for one, so both sides of an
   `other` job speak it. An older device of the same person cannot parse the request, so its transport drops and acks
   the envelope (`mail/transport.ts`) without claiming it; the device that claims it (ADR 0045) answers.

## Consequences

- A worker can list "Tailor" next to "Cook"; a household who says "I need a tailor for blouse stitching" is matched to
  the listed skill, asked what the work is, where, when and their budget, and their agent asks the nearby tailors.
- A household on an older build cannot read a card that lists only skills (its schema needs a trade), so scanning that
  worker's QR fails until the app updates. Board search on an older build is by trade only, so it never meets such a
  card.
- A worker's own skills are not offered in the colleague, mentor and Moving flows, which stay by trade.
- Matching quality without the embedding model is spelling-level: "darzi" does not find "tailor". The list is small
  in the pilot; the model, or skills worth promoting to trades, close the gap.
- When a skill is listed by enough workers and asked for enough, it is a candidate to become a trade, with its own
  questions and price drivers; `GET /v1/board/skills` already counts the workers.
- Migration 0013 adds the table. Neon is the live database and migrations run on deploy: merging this applies it.
