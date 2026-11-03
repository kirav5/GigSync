# ADR 0051: Questions that fit the job, on every phone

Date: 2026-11-03. Status: accepted. Amends [ADR 0046](0046-work-arrangements-hourly-to-monthly.md) §1 (arrangements
by the job's nature, for every kind of work, not maid and driver only) and §3 (Find offers only the arrangements that
fit), and [ADR 0047](0047-open-skills.md) §6 (a skill's card and need are asked how long the work is for). Keeps
[ADR 0040](0040-on-phone-model-router.md)/[0042](0042-meaning-router-small-embedding-model.md) ("models propose, code
decides") and [ADR 0041](0041-prices-from-drivers.md) (structured drivers price the job).

## Context

The founders, testing Find: a cook is always priced and booked by the month, and nobody asks whether the household
wants one meal, a few days a week or a month. Every job should be asked the way that job is hired: an electrician or a
plumber is one visit, a nanny is hours or a month. They asked for the model to read the job and choose the questions,
and for no fixed chips, so the chat follows what the person said.

What was in the code: the "how long" question (ADR 0046) existed for maid and driver only; a cook, a skill of a
worker's own (ADR 0047) and everything else were monthly or nothing. The day question offered "Every day" for a
repair. Find opened on a grid of all eight trades. The price questions were already per trade and per arrangement,
ranked by how much each moves the range (ADR 0041), and on a phone with a model the model already wrote them.

### Where the request is right, and where taking it literally would hurt

- **"Let the model decide the questions."** Most pilot phones cannot run the on-phone model (ADR 0040, 0042), and a
  cloud model for them is analysed but not decided ([PR #26](https://github.com/kirav5/GigSync/pull/26)). A model-led
  interview would be one product on a few phones and a different, fixed one on the rest. A small model also guesses:
  ADR 0042 found it answers "today" when no day was said. Left to choose, it would skip questions the household never
  answered. So the job's nature cannot live in the model.
- **"Not the static questions."** Most questions that look static are the price drivers, and those are already the
  job's own: rooms and tasks for house help, people and meals for a cook, the problem for a repair, asked only while
  they move the range. What was really fixed and wrong was the arrangement (maid and driver only), "Every day" for
  one-off work, and the opening grid.
- **"No static chips."** Chips are how a voice-first user who cannot type, or whose speech is misheard, answers at
  all. Removing them would shut those users out. The fault is chips that do not fit the job, not chips.
- **"The model's text is English and translated on the phone."** Only partly true. The need reader (`understandNeed`)
  reads English sentences only. The price model writes in the owner's language and code checks the script. Neither
  path suits chips: a chip in model words would be English on a Hindi screen, or an unchecked translation of an
  answer the household taps.
- **Estimates and records** rest on fixed keys: a request's `details.arrangement`, a record's `qty_arrangement`, the
  drivers. A free-form question cannot price a job or be compared across jobs.

## Decision

1. **The job's nature is data.** `WORK_ARRANGEMENTS` (`packages/protocol/src/arrangement.ts`) says how each kind of
   work is hired:
   - electrician, plumber, carpenter, AC technician and painter: one visit, never asked;
   - cook: one meal or occasion (`visit`), some days a week, or every month, never by the hour;
   - maid, driver, and work outside the trades (`other`): all four.

   Work with more than one arrangement is asked (`hasArrangements`); `fitsWork` says whether an arrangement fits the
   work, and the estimate schema refuses one that does not (a cook by the hour). It is the same on every phone, with
   or without a model, and is reviewed like the rate card.
2. **Find asks what fits** (`need-arrangement.ts`):
   - The "how long" chips are only the work's own: a cook sees "One meal or occasion", "Some days a week" and
     "Every month".
   - An arrangement said earlier ("a maid for 3 hours on Saturday", "a cook for a party", in any of the three
     languages) is taken without asking, if the work allows it.
   - Words may name any arrangement the work allows; a tap of one it does not allow changes nothing.
   - One-off work (a visit, a few hours, or work that is one visit by nature) gets no "Every day" chip at the day
     question.
   - For a skill of a worker's own, the phone's model, where it runs, may say how such work is usually hired
     (`how_long` in `understandNeed`). That narrows the chips; it never answers the question, and the household may
     still say any of the four. The model never narrows a trade's list.
3. **Chips stay, and only code or a closed list chooses them.** Every chip is a catalog value in en/hi/kn:
   - an arrangement chosen by code from the job's nature, or by the model from the four arrangements;
   - a driver's value (ADR 0041);
   - one of the model's fact choices, which code already checks for script and private data.

   No chip carries model words in another language. Find's first turn no longer shows all eight trades: it asks for
   the need in the owner's words, with one chip, "Pick from a list", that opens the trades for anyone who cannot say
   or type it. The trades also come after any answer that names no work.
4. **The worker's card asks the same** (`card-arrangements.ts`, My card's form):
   - A cook is offered one meal, some days a week and every month, with a rate for each, as ADR 0046 asks a maid.
   - A worker of their own skill is offered all four.
   - A skill card that names none takes any arrangement at its one rate. This is how skill cards worked before, so
     re-saving an existing card never makes its owner decline work. The form starts with none ticked for such a card.
   - The worker's agent declines an arrangement its owner does not take (`arrangementMandate`).
5. **Estimates where data exists, plainly nothing where it does not.**
   - Monthly cooking keeps the city card and GigSync's own monthly rates. The card estimate now asks for monthly by
     name, which prices the same.
   - A cook's one meal is priced by how many eat; a week by days, meals and people (`ARRANGEMENT_DRIVERS`,
     `jobFactor`).
   - No city card has a figure for a cook's meal or week yet. Find says "There is no going rate for this work on
     GigSync yet" beside the budget, rather than showing a monthly band against a one-meal budget. GigSync's own
     rates for those arrangements start counting from the first such jobs.
6. **Records and matching need no schema change.** The arrangement travels as `details.arrangement` (signed in the
   scope, ADR 0046 §6) and is kept in the existing `job_records.qty_arrangement`. No migration; Neon is untouched.
   - A board search for a cook's meal or week sends the arrangement, so only cooks whose card takes it are found.
   - A search for a skill sends none (`boardArrangement`): no skill card has arrangements on the board yet, and
     filtering would hide every skill worker.
7. **One-off work is one-off everywhere.** `recurs` (`job/when.ts`) treats a cook or maid hired for one visit or a few
   hours as on its one day: not on every later day of the calendar, settled once handed over, and never sent the
   monthly "pay again" prompt. Before this, that prompt went to a maid's one-off clean (ADR 0046) and would have gone
   to every cook's meal.

## Consequences

- Cooks with a card from before this are monthly only. A household wanting one meal finds only cooks who have since
  ticked it, so early searches find fewer cooks. A cook on an older build, reached directly by QR, would price a meal
  at their monthly rate. As ADR 0046 §6 says, the unit is shown with every offer, so nothing unseen is signed.
- One more question for a cook (how long), unless the first sentence said it.
- The founders' "dynamic" chat is code reading a table plus the model narrowing a closed list. A request for
  model-written chips in any language would need the translation and checking ADR 0042 has not settled.
- The rate card needs seeds for a cook's meal and week before those budgets show a range. They need the same review
  with the union as ADR 0046's. Until then the budget is the household's alone, and the screen says so.
- A worker of their own skill who names arrangements on the card is still found by searches for any arrangement. Their
  agent declines the ones they do not take. Filtering skill searches by arrangement waits until enough skill cards
  carry them.
- Find's opening has one chip, not eight. A user who can neither speak nor type taps it once more than before.
