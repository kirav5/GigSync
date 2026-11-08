import {
  ChatIntent,
  categorySkill,
  hintOf,
  listedSkill,
  modelJobType,
  NeedSay,
  NeedSlot,
  type NeedState,
  namesOtherWork,
  othersInGroup,
  type Ports,
  parseNeed,
  problemByMeaning,
  readScope,
  readTurn,
  sameWork,
  TurnKind,
  t,
  tradeByMeaning,
  tradeTitled,
  turnContext,
  understandNeed,
  workOptions,
  worthReading,
} from "@gigsync/core";
import type { Lang, Session, WorkCategory } from "@gigsync/protocol";
import { meaningFor } from "../adapters/meaning.js";
import { answerMarket, routedMarket } from "../estimate/market.js";
import {
  answerNeed,
  jobTypeNeed,
  kindNeed,
  needSay,
  nobodyNeed,
  showOwner,
  skillNeed,
  switchNeed,
} from "./needStore.js";
import { findRoute } from "./route.js";
import { listedWork } from "./skills.js";

/**
 * Reading a message in Find. With a model, one call reads it with the chat so far (`readTurn`), in any language; its
 * read goes before the word lists, which misread words like "kitchen". With none, or with no answer in time, the word
 * lists and the older readers do, as on a phone in lite mode. Models propose, the interview decides.
 */

export interface Message {
  ports: Ports;
  session: Session;
  state: NeedState;
  chat: string;
  text: string;
  aloud: boolean;
  lang: Lang;
}

/** "What do painters charge?" is answered in the chat from the estimate route (ADR 0039 §2); the need waits. */
async function marketAnswer(m: Message, slot: NeedSlot, shown: boolean): Promise<boolean> {
  const { ports, session, chat, text, lang } = m;
  const route = await findRoute(ports, lang, text, slot);
  const market = route.intent === ChatIntent.market ? routedMarket(text, route.slots) : undefined;
  if (!market) return false;
  if (!shown) showOwner(chat, text);
  const answer = await answerMarket(session, ports.model, lang, market);
  needSay(chat, { key: "estimate.answer", params: { text: answer.text } });
  return true;
}

/** The first message: the need in the owner's words, read into its work, its scope and the kind of job. */
export async function readFirst(m: Message): Promise<void> {
  const { ports, session, state, chat, text, aloud, lang } = m;
  const { list: kept, index } = await listedWork(ports, session, state.to?.skills);
  const read = await readTurn(ports.model, turnContext(state, text, workOptions(kept)));
  // A kind with nobody on a list a few minutes old is looked up again: someone may have just listed it.
  const stale = read?.category && !kept.some((s) => s.category === read.category);
  const list = stale ? (await listedWork(ports, session, state.to?.skills, true)).list : kept;
  if (read?.kind === TurnKind.enum.greeting) return needSay(chat, { key: NeedSay.greeting });
  if ((!read || read.kind === TurnKind.enum.market) && (await marketAnswer(m, NeedSlot.trade, true))) return;
  const { areas, today } = state.config;
  const hint = read ? hintOf(read) : await understandNeed(ports.model, text, { areas, lang });
  const meaning = meaningFor(ports);
  const lists = parseNeed(text, { areas, today }).trade;
  // A trade named outright stands, whatever a model reads: "I need a plumber" is a plumber.
  const titled = tradeTitled(text);
  // A kind of work no worker filed under yet may still be a worker's own words: "TV mechanic" for TV repair. Asked only
  // when the word lists see no trade in the words, which goes first: "पुताई" is painting, whatever the kind.
  const filed = (c: WorkCategory) =>
    categorySkill(c, list, lang) ?? (lists ? undefined : sameWork(ports.model, c, list));
  const found = titled ? undefined : read?.category ? await filed(read.category) : read?.skill;
  // A kind of work nobody lists does not end the chat when the word lists see a trade in the words: "पुताई" is painting.
  const named = titled ? undefined : read?.jobType || found;
  const said = titled ?? (read ? (read.trade ?? (named ? undefined : lists)) : (lists ?? hint.trade));
  const heard = said ?? (!named && meaning ? await tradeByMeaning(meaning.trades, text) : undefined);
  if (heard) hint.trade = heard;
  const trade = heard ?? state.draft.trade;
  const problemKind = trade && meaning ? await problemByMeaning(meaning.problems, trade, text) : undefined;
  if (problemKind) hint.problemKind = problemKind;
  // A kind of work no worker lists yet is said plainly: there is nobody to ask, and no nearest skill to force it into.
  if (!trade && read?.category && !found && !state.to) {
    const empty = { kind: read.category, others: othersInGroup(read.category, list) };
    return nobodyNeed(chat, t(lang, `category.${read.category}`), text, empty);
  }
  const skill = trade ? undefined : (found ?? (await listedSkill(text, list, index)));
  if (skill) return skillNeed(chat, skill, text, Boolean(read?.problem || read?.jobType || found), Boolean(found));
  const jobType = trade || !state.draft.modelAsk ? undefined : read ? read.jobType : await nameOf(m);
  if (jobType) return jobTypeNeed(chat, jobType, text);
  const scope = trade ? await readScope(ports.model, text, { trade, lang }) : [];
  answerNeed(chat, text, aloud, { ...hint, scope }, true, !titled && trade === read?.trade && trade !== undefined);
}

/** The model's name for the work when the one read gave no answer at all. */
const nameOf = ({ ports, text, lang }: Message) => modelJobType(ports.model, text, lang);

/**
 * A later message, at a question: the word lists and the interview take it. Only an answer they cannot use goes to the
 * model, never a secret one: if it names other work the chat offers to switch, instead of "Sorry" on repeat.
 */
export async function readLater(m: Message, secret: boolean, heard: NeedState): Promise<boolean> {
  const { ports, session, state, chat, text } = m;
  if (await marketAnswer(m, state.slot, false)) return true;
  if (secret || !worthReading(state, heard)) return false;
  const { list } = await listedWork(ports, session, state.to?.skills);
  const read = await readTurn(ports.model, turnContext(state, text, workOptions(list)));
  if (!read || !namesOtherWork(state, read)) return false;
  switchNeed(chat, read, text);
  return true;
}

/**
 * A kind of work outside the trades tapped on the list (ADR 0061): its workers' skill, looked up fresh, and the model
 * words the first question; with nobody listing it, the others in its group that have workers.
 */
export async function pickKind(m: Message, category: WorkCategory, label: string): Promise<void> {
  const { ports, session, state, chat, lang } = m;
  const { list } = await listedWork(ports, session, state.to?.skills, true);
  const skill = categorySkill(category, list, lang) ?? (await sameWork(ports.model, category, list));
  if (skill) return kindNeed(chat, skill, label);
  const empty = { kind: category, others: othersInGroup(category, list) };
  nobodyNeed(chat, t(lang, `category.${category}`), label, empty, label);
}
