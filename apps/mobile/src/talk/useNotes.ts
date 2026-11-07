import {
  answerSchedule,
  CardKind,
  ChatIntent,
  ChatRole,
  type ChatRoute,
  type Agent as CoreAgent,
  clarifyCard,
  editSaid,
  type InterviewState,
  log,
  type Ports,
  passbook,
  RouteVia,
} from "@gigsync/core";
import { useState } from "react";
import { type Account, AccountRole } from "../adapters/account.js";
import {
  addNote,
  beginInterview,
  dropNote,
  type NoteRef,
  noteAnswered,
  noteInOpen,
  noteReopened,
} from "../card/interviewStore.js";
import { answerMarket, routedMarket } from "../estimate/market.js";
import type { I18n } from "../i18n.js";
import { phoneNow } from "../schedule/useBookings.js";
import { errorKey } from "../ui/errorKey.js";
import { money } from "../ui/places.js";
import type { GigView } from "../useGig.js";
import { chatSoFar, openQuestion } from "./context.js";
import { moveCity } from "./moveStore.js";
import type { Turn } from "./turns.js";
import type { Moves } from "./useMoves.js";

/**
 * Talk's notes to the agent (ADR 0040, ADR 0042 amendment 2026-11-03): each is routed with the chat so far, answered
 * by whatever handles its intent (the card interview, a move, the market, the passbook, or the agent's own experts),
 * and asked about when the phone's model cannot tell what it means. `busy` holds the composer and shows the agent
 * thinking until the answer lands.
 */

/** What the agent's own experts answer: notes, questions, contacts, finding and chat. */
const AGENT_INTENTS: ReadonlySet<ChatIntent> = new Set([
  ChatIntent.remember,
  ChatIntent.askSelf,
  ChatIntent.askContact,
  ChatIntent.setRule,
  ChatIntent.find,
  ChatIntent.chat,
]);

export interface NoteDeps {
  agent: CoreAgent;
  ports: Ports;
  account: Account;
  view: GigView;
  i18n: Pick<I18n, "lang" | "t" | "date">;
  turns: readonly Turn[];
  moves: Moves;
  /** A card interview from the owner's card as it is now. */
  fresh: () => InterviewState;
  /** Words about the card while its interview waits at its first question: they answer it; false when none waits. */
  carryOn: (said: string) => boolean;
}

export interface Notes {
  busy: boolean;
  sendNote: (own: string) => Promise<void>;
  choose: (asked: { id: number; text: string }, intent: ChatIntent) => Promise<void>;
  answerEarnings: (note: NoteRef) => void;
}

export function useNotes({ agent, ports, account, view, i18n, turns, moves, fresh, carryOn }: NoteDeps): Notes {
  const { lang } = i18n;
  const [busy, setBusy] = useState(false);
  const isWorker = account.role === AccountRole.worker;

  /** The answer to a note from this phone's passbook: received this week and month, and still to come. */
  function answerEarnings(note: NoteRef) {
    const now = new Date();
    const { totals } = passbook(view.jobs, view.payments, account.session.user, now, -now.getTimezoneOffset());
    const params = { week: money(totals.week), month: money(totals.month), waiting: money(totals.waiting) };
    noteAnswered(note, { kind: CardKind.text, say: { key: "agent.earnings", params } });
  }

  /** Words that go on to an answer showing them itself: the note shown while routing makes way for it. */
  const handOver = (note: NoteRef, then: () => void) => {
    dropNote(note);
    then();
  };

  /** What Talk tells the router: who is asking, the chat so far, and that the agent may ask which they meant. */
  const routeContext = () => ({
    lang,
    role: isWorker ? ChatRole.worker : ChatRole.household,
    trades: account.worker?.trades ?? [],
    inMove: moveCity(turns) !== undefined,
    recent: chatSoFar(i18n, turns),
    mayAsk: true,
  });

  /** Where a routed note goes; the agent's experts answer whatever no screen handles, the chat so far in mind. */
  async function follow(route: ChatRoute, own: string, note: NoteRef): Promise<void> {
    const { intent, slots } = route;
    if (intent === ChatIntent.editCard)
      return handOver(
        note,
        () =>
          carryOn(own) ||
          beginInterview(account.worker && slots.field ? editSaid(fresh(), slots.field, own) : fresh(), own),
      );
    if (intent === ChatIntent.helpOffer) return handOver(note, () => moves.offer(own));
    if (intent === ChatIntent.helpStop) return handOver(note, () => moves.stop(own));
    if (intent === ChatIntent.moving) return handOver(note, () => moves.start(own, slots.city));
    if (intent === ChatIntent.earnings) return answerEarnings(note);
    // The worker's own bookings, read and kept on this phone (ADR 0048).
    if (intent === ChatIntent.schedule)
      return noteAnswered(note, await answerSchedule(own, ports.storage, ports.clock.now(), phoneNow(ports)));
    const market = intent === ChatIntent.market ? routedMarket(own, slots, account.worker?.trades[0]) : undefined;
    if (market) {
      // What the market pays, from the estimate route (ADR 0039 §2); the answer lands under the words when it comes.
      const answer = await answerMarket(account.session, ports.model, lang, market);
      return noteAnswered(note, { kind: CardKind.text, words: { text: answer.text, lang } });
    }
    // In a chat about a move, a question the city's guide answers is answered from it. Without a model the guide's
    // own words decide, as they always did: the word lists cannot see what the guide covers.
    const guide = intent === ChatIntent.guide || (route.via === RouteVia.keywords && AGENT_INTENTS.has(intent));
    if (guide && (await moves.followUp(own, () => dropNote(note)))) return;
    noteAnswered(note, await agent.answer(own, route, chatSoFar(i18n, turns)));
  }

  /** One note's work, with the composer held and the dots showing until it is answered; a failure is said there. */
  async function working(note: NoteRef, work: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      log.warn("note failed", { error: err instanceof Error ? err.message : String(err) });
      noteAnswered(note, { kind: CardKind.text, say: { key: errorKey(err) } });
    } finally {
      setBusy(false);
    }
  }

  /**
   * A note to the agent. When the model cannot tell what it means, the agent asks, with a choice per meaning; words
   * typed in reply that name one of those choices answer the question, for the words first asked.
   */
  async function sendNote(own: string) {
    if (busy || moves.busy) return;
    const ctx = routeContext();
    const question = openQuestion(turns);
    // Kept outside the screen: an answer that comes after the owner went to another screen still lands under its note.
    const note = addNote(own);
    await working(note, async () => {
      const route = await agent.route(own, ctx);
      const answers = question && !route.unsure && question.choices.includes(route.intent);
      const picked = answers ? await agent.chosen(route.intent, question.text, ctx) : undefined;
      if (picked && question) return follow(picked, question.text, note);
      if (route.unsure) return noteAnswered(note, clarifyCard(route.unsure));
      return follow(route, own, note);
    });
  }

  /** A choice under the agent's question: the note is answered again, as that meaning. */
  async function choose(asked: { id: number; text: string }, intent: ChatIntent) {
    if (busy || moves.busy) return;
    const note = noteInOpen(asked.id);
    noteReopened(note);
    await working(note, async () => {
      const route = await agent.chosen(intent, asked.text, routeContext());
      return follow(route ?? { intent: ChatIntent.chat, slots: {}, via: RouteVia.owner }, asked.text, note);
    });
  }

  return { busy, sendNote, choose, answerEarnings };
}
