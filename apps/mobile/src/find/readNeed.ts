import {
  ChatIntent,
  categorySkill,
  hintOf,
  listedSkill,
  type NeedHint,
  NeedSay,
  NeedSlot,
  type NeedState,
  namesOtherWork,
  othersInGroup,
  type Ports,
  problemByMeaning,
  readScope,
  readTurn,
  sameWork,
  t,
  tradeByMeaning,
  tradeTitled,
  turnContext,
  workOptions,
  worthReading,
} from "@gigsync/core";
import { type BoardSkill, type Lang, type Session, TurnKind, type WorkCategory } from "@gigsync/protocol";
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
 * Reading a message in Find. With a model, one call reads it with the chat so far (`readTurn`), in any language, and its
 * read decides what work it is and how it is hired: the word lists, which misread words like "kitchen" or "cleaning",
 * never do. With no answer, the chat asks which work and offers the list, rather than guess. The word lists still read
 * what they are sure of: an area, a day, an amount. Models propose, the interview decides.
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

/** The model's reading of one message; asked twice, since a dropped request is no reading. */
const readOnce = async (m: Message, list: readonly BoardSkill[]) =>
  (await readTurn(m.ports.model, turnContext(m.state, m.text, workOptions(list)))) ??
  (await readTurn(m.ports.model, turnContext(m.state, m.text, workOptions(list))));

/**
 * The first message: the need in the owner's words, read into its work, its scope and the kind of job. The model's
 * reading decides the work and how it is hired; the word lists never do, so "car cleaning" is no maid's and "next
 * month" no monthly work. A trade named outright stands ("I need a plumber"). With no reading, nothing is guessed:
 * the chat asks which work, with the list to pick from.
 */
export async function readFirst(m: Message): Promise<void> {
  const { ports, session, state, chat, text, aloud, lang } = m;
  const { list: kept, index } = await listedWork(ports, session, state.to?.skills);
  const read = await readOnce(m, kept);
  // A kind with nobody on a list a few minutes old is looked up again: someone may have just listed it.
  const stale = read?.category && !kept.some((s) => s.category === read.category);
  const list = stale ? (await listedWork(ports, session, state.to?.skills, true)).list : kept;
  if (read?.kind === TurnKind.enum.greeting) return needSay(chat, { key: NeedSay.greeting });
  if ((!read || read.kind === TurnKind.enum.market) && (await marketAnswer(m, NeedSlot.trade, true))) return;
  const hint: NeedHint = read ? hintOf(read) : { decided: true };
  const meaning = meaningFor(ports);
  const titled = tradeTitled(text);
  // A kind of work no worker filed under yet may still be a worker's own words: "TV mechanic" for TV repair.
  const filed = (c: WorkCategory) => categorySkill(c, list, lang) ?? sameWork(ports.model, c, list);
  const found = titled ? undefined : read?.category ? await filed(read.category) : read?.skill;
  const named = titled ? undefined : read?.jobType || found;
  const said = titled ?? read?.trade;
  const heard =
    said ?? (read && !named && !read.category && meaning ? await tradeByMeaning(meaning.trades, text) : undefined);
  if (heard) hint.trade = heard;
  const trade = heard ?? state.draft.trade;
  const problemKind = trade && meaning ? await problemByMeaning(meaning.problems, trade, text) : undefined;
  if (problemKind) hint.problemKind = problemKind;
  // A kind of work no worker lists yet is said plainly: there is nobody to ask, and no nearest skill to force it into.
  if (!trade && read?.category && !found && !state.to) {
    const empty = { kind: read.category, others: othersInGroup(read.category, list) };
    return nobodyNeed(chat, t(lang, `category.${read.category}`), text, empty);
  }
  const skill = trade || !read ? undefined : (found ?? (await listedSkill(text, list, index)));
  const how = { saysWhat: Boolean(read?.problem || read?.jobType || found), arrangement: read?.arrangement };
  if (skill) return skillNeed(chat, skill, text, how, Boolean(found));
  const jobType = trade || !read || !state.draft.modelAsk ? undefined : read.jobType;
  if (jobType) return jobTypeNeed(chat, jobType, text);
  const scope = trade ? await readScope(ports.model, text, { trade, lang }) : [];
  answerNeed(chat, text, aloud, { ...hint, scope }, true, !titled && trade === read?.trade && trade !== undefined);
}

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
 * A kind of work outside the trades tapped on the list (ADR 0061): its workers' skill, looked up fresh, asked its own
 * first question (ADR 0065); with nobody filed under it, the others in its group that have workers.
 */
export async function pickKind(m: Message, category: WorkCategory, label: string): Promise<void> {
  const { ports, session, state, chat, lang } = m;
  const { list } = await listedWork(ports, session, state.to?.skills, true);
  // Only workers filed under the kind: a guess among other workers' own words would put someone else's work in place
  // of the one tapped.
  const skill = categorySkill(category, list, lang);
  if (skill) return kindNeed(chat, skill, label);
  const empty = { kind: category, others: othersInGroup(category, list) };
  nobodyNeed(chat, t(lang, `category.${category}`), label, empty, label);
}
