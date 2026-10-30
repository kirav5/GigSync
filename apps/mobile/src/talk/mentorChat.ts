import {
  ARRIVAL_WEEKS,
  type ArrivalWeeks,
  AskStep,
  arrivalDay,
  askStep,
  FindStep,
  findStep,
  isArrivalWeeks,
  type Line,
  shownMentors,
  womenOnly,
} from "@gigsync/core";
import type { City, MentorProfile, UserId } from "@gigsync/protocol";
import { personCard } from "../adapters/account.js";
import { mentorProblem } from "../screens/mentor/problems.js";
import { agentSays, type ChatRef, outlookTrades, say, shownMentor, turnsOf } from "./moveStore.js";
import { type ActChoice, ActKind, MoveSpeaker } from "./moveTurns.js";
import type { MoveDeps } from "./moving.js";
import { nextTurnId, noteTurn, type Turn } from "./turns.js";

/**
 * "Find someone who knows the city", in the chat: the women-only question once, then up to three matched mentors as
 * chat cards, each with Ask. The first Ask shows the safety words, once; then the week she arrives; then the request
 * goes, and the mentor's answer comes to Today as before. Requests, offers and links are the core's, unchanged.
 */

const cityName = (city: City): NonNullable<Line["names"]> => ({ city: [`mentor.city.${city}`] });

/** The trade to match on: the card's first, else the one the chat's outlook was for; none means ask which work. */
const tradeFor = (deps: MoveDeps, ref: ChatRef) => deps.account.worker?.trades[0] ?? outlookTrades(turnsOf(ref))[0];

/** The match, as chat cards; with none, that nobody matches yet and the screen with more ways to find someone. */
async function search(deps: MoveDeps, ref: ChatRef, city: City): Promise<void> {
  const trade = tradeFor(deps, ref);
  if (!trade) return say(ref, agentSays([{ key: "moving.which_work" }]));
  const m = deps.device.mentors;
  try {
    const prefs = await m.newcomer();
    const found = shownMentors(await m.find({ city, trade, lang: deps.lang, women_only: womenOnly(prefs) }));
    const more = { label: { key: "moving.more_ways" }, act: { kind: ActKind.moreWays } } as const;
    if (found.length > 0) {
      const cards: Turn = { id: nextTurnId(), who: MoveSpeaker.mentors, city, mentors: found };
      return say(ref, agentSays([{ key: "moving.found", names: cityName(city) }]), cards);
    }
    const none: Line = { key: womenOnly(prefs) ? "mentor.none_women" : "moving.none", names: cityName(city) };
    say(ref, agentSays([none], [more]));
  } catch (err) {
    say(ref, agentSays([{ key: mentorProblem("finding mentors in talk failed", err) }]));
  }
}

/** "Find someone who knows the city": her answer to the women-only question first, if she has not given it. */
export async function findMentors(deps: MoveDeps, ref: ChatRef, said: string, city: City): Promise<void> {
  say(ref, noteTurn(said));
  const prefs = await deps.device.mentors.newcomer();
  if (findStep(prefs) === FindStep.search) return search(deps, ref, city);
  const answer = (woman: boolean): ActChoice => ({
    label: { key: woman ? "mentor.yes" : "mentor.no" },
    act: { kind: ActKind.woman, woman },
  });
  say(ref, agentSays([{ key: "mentor.woman_ask" }], [answer(true), answer(false)]));
}

/** Her answer to the women-only question, kept on the phone, then the match. */
export async function answerWoman(deps: MoveDeps, ref: ChatRef, woman: boolean, label: string, city: City) {
  say(ref, noteTurn(label));
  await deps.device.mentors.answerWoman(woman);
  await search(deps, ref, city);
}

/** When she arrives, as three taps: this week, next week, the week after. */
const arrivalQuestion = (city: City, mentor: UserId): Turn =>
  agentSays(
    [{ key: "moving.arrive", names: cityName(city) }],
    ARRIVAL_WEEKS.map((weeks) => ({
      label: { key: `moving.arrive_${weeks}` },
      act: { kind: ActKind.arrive, mentor, weeks },
    })),
  );

/** Ask on a mentor's card: the safety words first, once, then when she arrives. */
export async function askMentor(deps: MoveDeps, ref: ChatRef, mentor: MentorProfile, label: string, city: City) {
  say(ref, noteTurn(label));
  const prefs = await deps.device.mentors.newcomer();
  if (askStep(prefs) === AskStep.arrival) return say(ref, arrivalQuestion(city, mentor.user));
  const read = { label: { key: "mentor.safety_ok" }, act: { kind: ActKind.safety, mentor: mentor.user } } as const;
  const words: Line[] = [
    { key: "mentor.safety_title" },
    { key: "mentor.safety_public" },
    { key: "mentor.safety_money" },
    { key: "mentor.safety_report" },
  ];
  say(ref, agentSays(words, [read]));
}

/** She read the safety words: kept, so they show once, then when she arrives. */
export async function safetyRead(deps: MoveDeps, ref: ChatRef, mentor: UserId, label: string, city: City) {
  say(ref, noteTurn(label));
  await deps.device.mentors.safetySeen();
  say(ref, arrivalQuestion(city, mentor));
}

/** The request to the mentor she asked, for the week she picked; the answer comes to Today. */
export async function sendAsk(
  deps: MoveDeps,
  ref: ChatRef,
  mentor: UserId,
  weeks: ArrivalWeeks,
  label: string,
  city: City,
) {
  say(ref, noteTurn(label));
  const profile = shownMentor(turnsOf(ref), mentor);
  const trade = tradeFor(deps, ref);
  // A chip read back from an older app may name weeks this one does not offer.
  if (!profile || !trade || !isArrivalWeeks(weeks)) return;
  const card = personCard(deps.account, deps.lang);
  const ask = { city, trade, languages: card.languages, arrival_week: arrivalDay(deps.ports.clock.now(), weeks) };
  try {
    let tooOld = false;
    await deps.run(async () => {
      tooOld = (await deps.device.mentors.request([profile], ask, card)).tooOld.length > 0;
    });
    const name = profile.first_name;
    say(ref, agentSays([{ key: tooOld ? "mentor.too_old" : "moving.sent", params: { name } }]));
  } catch (err) {
    say(ref, agentSays([{ key: mentorProblem("asking a mentor in talk failed", err), params: { name: "" } }]));
  }
}
