import {
  ChatIntent,
  hintOf,
  modelJobType,
  NeedSay,
  NeedSlot,
  type NeedState,
  namesOtherWork,
  type Ports,
  parseNeed,
  problemByMeaning,
  readScope,
  readTurn,
  TurnKind,
  tradeByMeaning,
  turnContext,
  understandNeed,
  worthReading,
} from "@gigsync/core";
import type { Lang, Session } from "@gigsync/protocol";
import { meaningFor } from "../adapters/meaning.js";
import { answerMarket, routedMarket } from "../estimate/market.js";
import { answerNeed, jobTypeNeed, needSay, showOwner, skillNeed, switchNeed } from "./needStore.js";
import { findRoute } from "./route.js";
import { skillAsked } from "./skills.js";

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
  const read = await readTurn(ports.model, turnContext(state, text));
  if (read?.kind === TurnKind.enum.greeting) return needSay(chat, { key: NeedSay.greeting });
  if ((!read || read.kind === TurnKind.enum.market) && (await marketAnswer(m, NeedSlot.trade, true))) return;
  const { areas, today } = state.config;
  const hint = read ? hintOf(read) : await understandNeed(ports.model, text, { areas, lang });
  const meaning = meaningFor(ports);
  const lists = parseNeed(text, { areas, today }).trade;
  const said = read ? (read.trade ?? (read.jobType ? undefined : lists)) : (lists ?? hint.trade);
  const heard = said ?? (!read?.jobType && meaning ? await tradeByMeaning(meaning.trades, text) : undefined);
  if (heard) hint.trade = heard;
  const trade = heard ?? state.draft.trade;
  const problemKind = trade && meaning ? await problemByMeaning(meaning.problems, trade, text) : undefined;
  if (problemKind) hint.problemKind = problemKind;
  // Outside the trades: a skill workers list (ADR 0047), by name or by what the words mean; else the model names the work.
  const asked = (words: string) => skillAsked(ports, session, words, state.to?.skills);
  const skill = trade ? undefined : ((await asked(text)) ?? (read?.jobType ? await asked(read.jobType) : undefined));
  if (skill) return skillNeed(chat, skill, text, Boolean(read?.problem || read?.jobType));
  const jobType =
    trade || !state.draft.modelAsk ? undefined : (read?.jobType ?? (await modelJobType(ports.model, text, lang)));
  if (jobType) return jobTypeNeed(chat, jobType, text);
  const scope = trade ? await readScope(ports.model, text, { trade, lang }) : [];
  answerNeed(chat, text, aloud, { ...hint, scope }, true);
}

/**
 * A later message, at a question: the word lists and the interview take it. Only an answer they cannot use goes to the
 * model, never a secret one: if it names other work the chat offers to switch, instead of "Sorry" on repeat.
 */
export async function readLater(m: Message, secret: boolean, heard: NeedState): Promise<boolean> {
  const { ports, state, chat, text } = m;
  if (await marketAnswer(m, state.slot, false)) return true;
  if (secret || !worthReading(state, heard)) return false;
  const read = await readTurn(ports.model, turnContext(state, text));
  if (!read || !namesOtherWork(state, read)) return false;
  switchNeed(chat, read, text);
  return true;
}
