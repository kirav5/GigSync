// One person through Find, driven as FindChat.tsx drives it: `say` and `tap` move the real interview (core's functions)
// and the model is asked when the app would ask it. What the person says back comes from their conversation file.
import { core } from "./core.mjs";

const { NeedSlot } = core;
/** What reads a message: the three prompts and the lists, or one reader for every message. */
export const Reader = { lists: "lists", turn: "turn" };
const AREAS = core.PILOT_AREA_CHOICES;
const HOME = { id: "adr_01JC0000000000000000000001", label: "home", areaName: "HSR Layout", area: "hsr_layout" };
/** What workers list on the board in these conversations: the skills a phone would fetch. */
const LISTED = [
  "TV repair",
  "Fridge repair",
  "Laptop repair",
  "Tailor",
  "Pest control",
  "Maths tutor",
  "Gardener",
  "Mehendi artist",
  "Yoga teacher",
  "Car wash",
].map((text) => ({ text, key: text.toLowerCase(), lang: "en", workers: 3 }));
const TODAY = "2026-11-10";
/** A long way past any real chat: a conversation still going is stuck. */
const MAX_TURNS = 14;
const BUDGET = "2500";
const DONT_KNOW = "I don't know";
/** Chips that say nothing about the job: taken only when there is nothing else. */
const NOT_ANSWERS = new Set(["iv.skip", "driver.dont_know"]);
const SORRY_KEYS = new Set(["need.again", "need.again_budget"]);
/** How long one model call may take here: long enough to measure, not the phone's limit. */
const WAIT_MS = 20_000;

const start = (lang) =>
  core.startNeed({
    own: lang,
    areas: AREAS,
    rates: core.CITY_RATES,
    today: TODAY,
    hour: 9,
    addresses: [HOME],
    inUse: HOME.id,
    modelQuestions: true,
  });

const wordsOf = (state, lang) =>
  core
    .needPrompt(state)
    .lines.map((l) =>
      core.t(lang, l.key, { ...l.params, ...Object.fromEntries(Object.keys(l.names ?? {}).map((k) => [k, ""])) }),
    )
    .join(" ");

const sorry = (state) => core.needPrompt(state).lines.some((l) => SORRY_KEYS.has(l.key));

/** The first sentence, read as `send` in FindChat.tsx reads it. */
async function firstWords(model, s, text, lang) {
  const hint = await core.understandNeed(model, text, { areas: AREAS, lang, waitMs: WAIT_MS });
  const trade = core.parseNeed(text, { areas: AREAS, today: TODAY }).trade ?? hint.trade;
  if (trade) hint.trade = trade;
  const jobType = !trade && s.draft.modelAsk ? await core.modelJobType(model, text, lang, WAIT_MS) : undefined;
  if (jobType) return core.withJobType(s, jobType, text);
  const scope = trade ? await core.readScope(model, text, { trade, lang, waitMs: WAIT_MS }) : [];
  return core.hearNeed(s, text, false, { ...hint, scope });
}

/** The first sentence as the one reader takes it (read-turn.ts), and as the word lists do when it gives nothing. */
async function firstTurn(model, s, text, lang) {
  const read = await core.readTurn(model, core.turnContext(s, text), WAIT_MS);
  if (!read) return firstWords(model, s, text, lang);
  if (read.kind === core.TurnKind.enum.greeting) return s;
  const trade = read.trade ?? (read.jobType ? undefined : core.parseNeed(text, { areas: AREAS, today: TODAY }).trade);
  const asked = async (words) =>
    (await core.listedSkill(words, LISTED)) ?? (await core.pickSkill(model, words, LISTED, WAIT_MS));
  const skill = trade ? undefined : ((await asked(text)) ?? (read.jobType ? await asked(read.jobType) : undefined));
  if (skill) return core.withSkill(s, skill, text, Boolean(read.problem || read.jobType));
  const jobType = trade ? undefined : (read.jobType ?? (await core.modelJobType(model, text, lang, WAIT_MS)));
  if (jobType) return core.withJobType(s, jobType, text);
  const scope = trade ? await core.readScope(model, text, { trade, lang, waitMs: WAIT_MS }) : [];
  return core.hearNeed(s, text, false, { ...core.hintOf(read), scope });
}

/** Words at a later question: the interview's, and when it did not understand them, the one reader's. */
async function laterTurn(model, s, text, reader, log) {
  const heard = core.hearNeed(s, text);
  if (reader !== Reader.turn || !core.worthReading(s, heard) || s.slot === NeedSlot.budget) return heard;
  const read = await core.readTurn(model, core.turnContext(s, text, core.needPrompt(s).lines[0]?.key), WAIT_MS);
  if (!read || !core.namesOtherWork(s, read)) return heard;
  log.switched = true;
  return core.chooseNeed(core.offerSwitch(s, read, text), "no");
}

/** The model's question, when it is the one open. */
async function modelAsks(model, s) {
  let at = s;
  while (core.askingModel(at))
    at = core.withPriceStep(at, await core.modelPriceStep(model, core.priceContext(at), WAIT_MS));
  return at;
}

/** What the person does at a question: taps a chip where one fits, as most do, and uses words where none is offered. */
function reply(s, conversation, used) {
  const prompt = core.needPrompt(s);
  const chips = (prompt.choices ?? []).filter((c) => !NOT_ANSWERS.has(c.key));
  if (s.slot === NeedSlot.budget) return { say: BUDGET };
  if (chips.length > 0 && s.slot !== NeedSlot.when) return { tap: chips[0].value };
  if (s.slot === NeedSlot.when) return { say: core.needsHour?.(s.draft) || s.draft.day ? "10 am" : "tomorrow" };
  return { say: conversation.answers[used.answers++] ?? DONT_KNOW };
}

/** Runs one conversation: the record the scorer reads. */
export async function runConversation(model, conversation, lang, reader = Reader.lists) {
  const says = [...conversation.says];
  let later = conversation.later;
  const used = { answers: 0 };
  const log = { asked: [], sorries: 0, job: undefined, end: "stuck" };
  let s = start(lang);
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (s.slot === NeedSlot.confirm) {
      log.end = "ready";
      break;
    }
    if (s.slot === NeedSlot.outside) {
      log.end = "outside";
      break;
    }
    const first = s.slot === NeedSlot.trade;
    const next = first ? says.shift() : undefined;
    if (first && next === undefined) break;
    if (next !== undefined) {
      const read = reader === Reader.turn ? firstTurn : firstWords;
      s = core.isGreeting(next) ? s : await read(model, s, next, lang);
    } else if (later && s.slot !== NeedSlot.budget) {
      s = await laterTurn(model, s, later, reader, log);
      later = undefined;
    } else {
      const action = reply(s, conversation, used);
      s = action.tap ? core.chooseNeed(s, action.tap) : await laterTurn(model, s, action.say, reader, log);
    }
    s = await modelAsks(model, s);
    if (sorry(s)) log.sorries++;
    // After a no to switching the same question comes back: that is no repeat.
    const backAgain = log.switched && log.asked.at(-1) === wordsOf(s, lang);
    if ((s.slot === NeedSlot.driver || s.slot === NeedSlot.detail) && !backAgain) log.asked.push(wordsOf(s, lang));
  }
  const { trade, skill, jobType } = s.draft;
  log.job = trade ? { trade } : skill ? { skill: skill.text } : jobType ? { outside: jobType } : undefined;
  return log;
}
