# ADR 0059: Kinds of work behind a worker's own words

Date: 2026-11-07. Status: accepted. Amends [ADR 0047](0047-open-skills.md) (a skill may name a kind of work) and reverses
the choice in [ADR 0057](0057-find-listed-work-by-what-the-words-mean.md) §Context not to keep a category list.

## Context

Since ADR 0047 a worker lists work in their own words, so one kind of work has many names: "TV repair", "TV mechanic",
"टीवी ठीक करना". ADR 0057 had the model pick one listed name for a household's words, which finds the workers of that
name and not the others: a worker can miss a job because of how they worded their skill. The founders asked on
2026-11-07 for categories, so that different wordings land together.

ADR 0057 turned a list down because it needs upkeep and lags behind what workers list, and because a label a model
writes differs from run to run. The second reason does not apply when the model points at a fixed list and writes
nothing. The first is the real cost, and it is accepted here.

A word that fails the other way: a worker who types "AC mechanic" used to stay a plain skill, because only a trade's
exact words picked the trade, and a search for the trade would never find them.

## Decision

1. **A fixed list of narrow kinds of work** (`WorkCategory` in `packages/protocol`), 54 of them, each named in English,
   Hindi and Kannada. Narrow on purpose: one "appliance repair" would send a TV-only worker to a washing machine. The
   trades stay as they are and are not in it: a category is not under a trade, and a card can hold both.
2. **The worker's words stay.** `worker_skills.category` (migration 0016) is optional and sits beside them. The card still
   says "TV mechanic". A skill that fits nothing keeps no category and is still found by its own name, so a worker can
   still list anything (ADR 0047).
3. **The worker decides.** The exact name of a kind of work is filed with no question. Anything else gets one model call
   when the skill is listed, choosing among the trades and the kinds of work, and the card asks "Is this TV repair?".
   Only a yes sets it; a yes to a trade moves the work to that trade, so its prices and questions apply.
4. **Search and rates take a category.** `GET /v1/board/workers` and `GET /v1/board/rates` accept one, and a worker counts
   once however many wordings they list. `GET /v1/board/skills` says each skill's category.
5. **A card sent again keeps its categories**, because a phone's copy may predate one set on the server.
6. Groups (Appliances, Teaching) only order the list in code. Nothing stores or searches them.
7. **Find reads the work in one call.** The reader of [ADR 0056](0056-one-reader-for-every-message-in-find.md) chooses
   from the trades, the kinds of work and up to 30 listed skills that fit no kind, replacing the model's pick from the
   listed skills, its check and its job-type call. A search for a kind of work finds every wording of it.
8. **The model answers with a name, held to the list by the reply's schema.** With numbers it drifted to the lines around
   the one it meant: "swimming coach" came back as Yoga teacher in all five sets.
9. **A kind of work nobody lists is said plainly**, with no price questions, since there is nobody to send it to. If the
   word lists see a trade in the words, the trade goes first, so a wrong guess at an empty kind does not end the chat.
10. **A trade named outright stands.** "I need a plumber" is a plumber whatever a model reads; the rule is for a trade's
    names only, not the lists' words that merely suggest one, such as "kitchen", which is why the model went first.
11. **A guess is shown, and one tap takes it back.** When a model chose the work, the next question says "For: AC
    technician" with a "Not this" chip. It costs no tap when the guess is right, so it is not a confirm step, and it
    comes before anyone answers questions about the wrong work.

## Consequences

- Skills already listed have no category until they are sorted, or until their worker lists them again.
- The list needs looking after: new kinds of work appear first as skills with none. It lives in code, so adding one is a
  release, and each one needs three names and a native speaker's check.
- A skill said in the card interview, by voice, is only filed by its exact name: the question is on the card screen.
- On 20 worker wordings on the 30B the suggestion was right on 18. It offered Cobbler for "ದರ್ಜಿ ಕೆಲಸ" (tailoring), which
  a worker taps No to, and nothing for "ಗಿಡ ಕೆಲಸ", which then stays in the worker's words.

On 120 conversations on the 30B, with mixed wordings on the board:

| Measure                     | Before | After |
| --------------------------- | ------ | ----- |
| Calls a chat                | 2.1    | 1.3   |
| Most calls in a chat        | 6      | 3     |
| Model time a chat           | 1.3 s  | 0.8 s |
| Right job                   | 95%    | 97%   |
| Reached the end of the chat | 97%    | 98%   |
| No "Sorry"                  | 97%    | 99%   |
| Offered a switch            | 80%    | 100%  |

42 of 44 listed-skill requests found the right work, and none matched a wrong skill, so the second check ADR 0057 added
is gone. The prompts were tuned on these conversations, so real use will score lower. The misses that remain are one
Hindi and one Kanglish fish tank said to be nobody's work, because the model chose an empty kind of cleaning, and two
Kanglish requests.
