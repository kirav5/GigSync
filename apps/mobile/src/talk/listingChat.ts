import {
  answerListing,
  type Line,
  type ListingAnswer,
  type ListingChoices,
  type ListingDraft,
  ListingStep,
  listingReady,
  type MentorChoices,
  type MentorRecord,
  MULTI_STEPS,
  nextListingStep,
  startListing,
} from "@gigsync/core";
import { City, DEFAULT_MENTOR_SLOTS, Lang, MENTOR_MIN_JOBS, MENTOR_MIN_MONTHS } from "@gigsync/protocol";
import type { Account } from "../adapters/account.js";
import { mentorProblem } from "../screens/mentor/problems.js";
import { AREAS, areaNamed } from "../ui/places.js";
import { agentSays, type ChatRef, openDraft, replace, say, turnsOf } from "./moveStore.js";
import { type ActChoice, ActKind } from "./moveTurns.js";
import type { MoveDeps } from "./moving.js";
import { noteTurn, type Turn } from "./turns.js";

/**
 * Offering to help people new to the city, in the chat (it was a form in Profile): refused with the reason until the
 * phone's own record shows the minimum; then the listing's choices as short questions, a summary to confirm, and the
 * publish. "Stop helping newcomers" takes the owner off the list. Nobody approves anyone: the record is the rule.
 */

const S = ListingStep;
/** How many newcomers at a time a mentor may choose from, as chips. */
const SLOT_CHOICES = [1, 2, 3, 4, 5] as const;
/** The listing is for the pilot's city, the one with a guide. */
const LISTING_CITY = City.enum.bengaluru;
const CITY_NAMES = { city: [`mentor.city.${LISTING_CITY}` as const] };

/** The mentor rule and the phone's own count, for the words that say why someone cannot list yet. */
const minimum = (record: MentorRecord) => ({
  min_months: MENTOR_MIN_MONTHS,
  min_jobs: MENTOR_MIN_JOBS,
  jobs: record.jobs,
  months: record.months,
});

/** The owner's earlier choices, or a start from their card: first name, its area, trades and languages. */
function startingChoices(account: Account, lang: Lang, saved: MentorChoices | undefined): ListingChoices {
  if (saved) return saved;
  const base = account.worker?.base;
  const area = AREAS.find((a) => a.lat === base?.lat && a.lon === base?.lon) ?? AREAS[0];
  return {
    first_name: account.contact.name.split(" ")[0] ?? account.contact.name,
    city: LISTING_CITY,
    area: area.name,
    trades: account.worker?.trades ?? [],
    languages: account.languages ?? [lang],
    woman: false,
    women_only_newcomers: false,
    slots: DEFAULT_MENTOR_SLOTS,
  };
}

const chip = (label: Line, answer: ListingAnswer, on?: boolean): ActChoice => ({
  label,
  act: { kind: ActKind.listing, answer },
  on,
});
const yesNo = (make: (yes: boolean) => ListingAnswer) => [
  chip({ key: "mentor.yes" }, make(true)),
  chip({ key: "mentor.no" }, make(false)),
];
const done = (step: typeof S.trades | typeof S.languages) => chip({ key: "moving.done" }, { step, done: true });

/** The summary newcomers will see, and Publish or Not now. */
function confirmTurn(draft: ListingDraft): Turn {
  const c = draft.choices;
  const area = areaNamed(c.area);
  const summary: Line = {
    key: "moving.list_confirm",
    params: { name: c.first_name, slots: c.slots },
    names: {
      area: [`area.${area.key}`],
      trades: c.trades.map((tr) => `trade.${tr}` as const),
      langs: c.languages.map((l) => `lang.${l}` as const),
    },
  };
  const choices: ActChoice[] = [
    ...(listingReady(draft) ? [{ label: { key: "moving.list_yes" }, act: { kind: ActKind.publish } } as const] : []),
    { label: { key: "moving.list_no" }, act: { kind: ActKind.notNow } },
  ];
  return agentSays([summary, { key: "mentor.offer_about" }], choices, draft);
}

/** The next question of the listing, with its chips; the summary once every question is answered. */
function question(account: Account, draft: ListingDraft): Turn {
  const c = draft.choices;
  const ask = (key: Line["key"], choices: ActChoice[]) => agentSays([{ key, names: CITY_NAMES }], choices, draft);
  switch (nextListingStep(draft, account.worker?.trades ?? [])) {
    case S.area:
      return ask(
        "moving.list_area",
        AREAS.map((a) => chip({ key: `area.${a.key}` }, { step: S.area, area: a.name })),
      );
    case S.trades: {
      const trades = account.worker?.trades ?? [];
      const each = trades.map((trade) =>
        chip({ key: `trade.${trade}` }, { step: S.trades, trade }, c.trades.includes(trade)),
      );
      return ask("moving.list_trades", [...each, done(S.trades)]);
    }
    case S.languages: {
      const each = Lang.options.map((l) =>
        chip({ key: `lang.${l}` }, { step: S.languages, lang: l }, c.languages.includes(l)),
      );
      return ask("moving.list_languages", [...each, done(S.languages)]);
    }
    case S.woman:
      return ask(
        "moving.list_woman",
        yesNo((woman) => ({ step: S.woman, woman })),
      );
    case S.womenOnly:
      return ask(
        "moving.list_women_only",
        yesNo((on) => ({ step: S.womenOnly, on })),
      );
    case S.slots:
      return ask(
        "moving.list_slots",
        SLOT_CHOICES.map((n) => chip({ key: "moving.slots", params: { n } }, { step: S.slots, slots: n })),
      );
    case S.confirm:
      return confirmTurn(draft);
  }
}

/** "I can help people new to Bengaluru": the reason when the record is short, else the first question. */
export async function offerHelp(deps: MoveDeps, ref: ChatRef, said: string): Promise<void> {
  say(ref, noteTurn(said));
  const m = deps.device.mentors;
  const [record, saved] = await Promise.all([m.record(), m.choices()]);
  if (!record.eligible) return say(ref, agentSays([{ key: "moving.not_eligible", params: minimum(record) }]));
  const draft = startListing(startingChoices(deps.account, deps.lang, saved));
  say(ref, question(deps.account, draft));
}

/**
 * A chip on the listing's newest question: on a question that takes several, the chip is picked or unpicked in place;
 * any other answer is said, and the next question asked.
 */
export function answerQuestion(deps: MoveDeps, ref: ChatRef, answer: ListingAnswer, label: string): void {
  const turns = turnsOf(ref);
  const draft = openDraft(turns);
  const last = turns.at(-1);
  if (!draft || !last) return;
  const next = answerListing(draft, answer);
  if (next === draft) return;
  const toggle = MULTI_STEPS.has(answer.step) && !("done" in answer);
  if (toggle) replace(ref, { ...question(deps.account, next), id: last.id });
  else say(ref, noteTurn(label), question(deps.account, next));
}

/** "List me": the listing goes to the server, refused unless the record reaches the minimum. */
export async function publishListing(deps: MoveDeps, ref: ChatRef, label: string): Promise<void> {
  const draft = openDraft(turnsOf(ref));
  if (!draft || !listingReady(draft)) return;
  say(ref, noteTurn(label));
  try {
    await deps.run(() => deps.device.mentors.publish(draft.choices));
    say(ref, agentSays([{ key: "mentor.listed", names: CITY_NAMES }]));
  } catch (err) {
    const key = mentorProblem("mentor listing in talk failed", err);
    say(ref, agentSays([{ key, params: minimum(await deps.device.mentors.record()) }]));
  }
}

/** "Not now": nothing is published. */
export function listingLater(ref: ChatRef, label: string): void {
  if (!openDraft(turnsOf(ref))) return;
  say(ref, noteTurn(label), agentSays([{ key: "moving.list_later" }]));
}

/** "Stop helping newcomers": off the list, or that they were not on it. */
export async function stopHelping(deps: MoveDeps, ref: ChatRef, said: string): Promise<void> {
  say(ref, noteTurn(said));
  const listed = (await deps.device.mentors.choices())?.listed === true;
  if (!listed) return say(ref, agentSays([{ key: "moving.not_listed" }]));
  try {
    await deps.run(() => deps.device.mentors.unpublish());
    say(ref, agentSays([{ key: "moving.unlisted" }]));
  } catch (err) {
    say(ref, agentSays([{ key: mentorProblem("mentor unlisting in talk failed", err) }]));
  }
}
