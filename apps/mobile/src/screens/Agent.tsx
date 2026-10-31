import {
  CardKind,
  ChatIntent,
  ChatRole,
  type ChatRoute,
  type Agent as CoreAgent,
  edit,
  type GigDevice,
  log,
  movingIntent,
  type Ports,
  passbook,
  prompt,
  RouteVia,
  Slot,
  start,
} from "@gigsync/core";
import type { City } from "@gigsync/protocol";
import { useEffect, useRef, useState } from "react";
import { type Account, AccountRole } from "../adapters/account.js";
import { interviewConfig } from "../card/choices.js";
import {
  addNote,
  answerInterview,
  beginInterview,
  dropNote,
  type NoteRef,
  noteAnswered,
  pauseInterview,
  relanguageInterview,
  resumeInterview,
} from "../card/interviewStore.js";
import { accountDraft } from "../card/publish.js";
import { answerMarket, routedMarket } from "../estimate/market.js";
import { useI18n } from "../i18n.js";
import { moveCity } from "../talk/moveStore.js";
import { openChat, useTalk } from "../talk/talkStore.js";
import { useMoves } from "../talk/useMoves.js";
import { Composer, Via } from "../ui/Composer.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { errorKey } from "../ui/errorKey.js";
import { money } from "../ui/places.js";
import type { GigView } from "../useGig.js";
import { Interview } from "./Interview.js";
import { type Suggestion, Suggestions } from "./talk/TalkStart.js";
import "./talk.css";

/** What the agent's own experts answer: notes, questions, contacts, finding and chat. */
const AGENT_INTENTS: ReadonlySet<ChatIntent> = new Set([
  ChatIntent.remember,
  ChatIntent.askSelf,
  ChatIntent.askContact,
  ChatIntent.setRule,
  ChatIntent.find,
  ChatIntent.chat,
]);

interface TalkProps {
  agent: CoreAgent;
  ports: Ports;
  account: Account;
  /** Start (or resume) the card interview on opening Talk. */
  interview: boolean;
  /** The account after the interview published the card. */
  onSaved: (a: Account) => void;
  /** Opens the moving checklist (the landing journey) for the city of the move Talk is about. */
  onChecklist: (city: City) => void;
  /** Opens Find a mentor, the fallback with introductions, when nobody in the chat's search matches. */
  onFindMentor: () => void;
  /** This phone's jobs and payments, for "what did I earn this week?". */
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
}

/**
 * Talk: chats with the worker's agent, kept on this phone: notes and its answers (lite mode without a model), and the
 * card interview when there is no card yet or the owner asked to change it by talking. Words that ask to change a
 * field of the card ("मेरा रेट बदलो") open the interview at that field, below what was said before. Moving to a new
 * city, offering to help newcomers and the guide's answers are all in the chat (`talk/useMoves.ts`): no menu to find.
 * Past chats and "New chat" are in the menu (shell/DrawerChats.tsx), as in the collab app.
 */
export function AgentScreen(props: TalkProps) {
  const { agent, ports, account, interview, onSaved, onChecklist, onFindMentor, view, device, run } = props;
  const { lang, t } = useI18n();
  const { ready, open, state, turns, paused, interviewIn } = useTalk();
  const [busy, setBusy] = useState(false);
  const moves = useMoves({ ports, account, device, run, lang }, { onChecklist, onMoreWays: onFindMentor });
  const opened = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const active = state !== undefined && !paused;
  const current = active ? prompt(state) : undefined;
  const wanted = interview || !account.worker;

  // Opening Talk to make or change the card starts the interview; one already under way carries on where it was, in
  // the chat it belongs to. One paused ("Later", or left for another chat) stays paused until the owner taps "Carry on".
  useEffect(() => {
    if (opened.current || !wanted || !ready) return;
    opened.current = true;
    if (!interviewIn) beginInterview(start(interviewConfig(lang), accountDraft(account)));
    else if (interviewIn !== open) openChat(interviewIn);
  }, [wanted, ready, interviewIn, open, lang, account]);

  // A language picked in About me part-way: the questions from here on, and what the mic listens for, follow it.
  useEffect(() => {
    if (state && state.config.own !== lang) relanguageInterview(interviewConfig(lang));
  }, [state, lang]);

  // The newest turn, or the answer that just came to a note, stays in view.
  useEffect(() => {
    if (turns.length > 0) end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  const fresh = () => start(interviewConfig(lang), accountDraft(account));

  /** The answer to a note from this phone's passbook: received this week and month, and still to come. */
  function answerEarnings(note: NoteRef) {
    const now = new Date();
    const { totals } = passbook(view.jobs, view.payments, account.session.user, now, -now.getTimezoneOffset());
    const params = { week: money(totals.week), month: money(totals.month), waiting: money(totals.waiting) };
    noteAnswered(note, { kind: CardKind.text, say: { key: "agent.earnings", params } });
  }

  const isWorker = account.role === AccountRole.worker;
  /** Ways in for an empty Talk, at most three; changing the rate needs a card, a move is for a worker. */
  const suggestions: Suggestion[] = [
    ...(account.worker
      ? [
          {
            label: "agent.suggest_rate",
            run: (said: string) => beginInterview(edit(fresh(), Slot.rate), said),
          } as const,
        ]
      : []),
    { label: "agent.suggest_earned", run: (said: string) => answerEarnings(addNote(said)) },
    ...(isWorker ? [{ label: "moving.suggest", run: (said: string) => moves.start(said, undefined) } as const] : []),
  ];

  /** Words that go on to an answer showing them itself: the note shown while routing makes way for it. */
  const handOver = (note: NoteRef, then: () => void) => {
    dropNote(note);
    then();
  };

  /** Where a routed note goes; the agent's experts answer whatever no screen handles. */
  async function follow(route: ChatRoute, own: string, note: NoteRef): Promise<void> {
    const { intent, slots } = route;
    if (intent === ChatIntent.editCard)
      return handOver(note, () =>
        beginInterview(account.worker && slots.field ? edit(fresh(), slots.field) : fresh(), own),
      );
    if (intent === ChatIntent.helpOffer) return handOver(note, () => moves.offer(own));
    if (intent === ChatIntent.helpStop) return handOver(note, () => moves.stop(own));
    if (intent === ChatIntent.moving) return handOver(note, () => moves.start(own, slots.city));
    if (intent === ChatIntent.earnings) return answerEarnings(note);
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
    noteAnswered(note, await agent.answer(own, route));
  }

  async function sendNote(own: string) {
    if (busy || moves.busy) return;
    setBusy(true);
    // Kept outside the screen: an answer that comes after the owner went to another screen still lands under its note.
    const note = addNote(own);
    try {
      const trades = account.worker?.trades ?? [];
      const role = isWorker ? ChatRole.worker : ChatRole.household;
      const route = await agent.route(own, { lang, role, trades, inMove: moveCity(turns) !== undefined });
      await follow(route, own, note);
    } catch (err) {
      log.warn("note failed", { error: err instanceof Error ? err.message : String(err) });
      noteAnswered(note, { kind: CardKind.text, say: { key: errorKey(err) } });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Mid-interview, words go to the interview, except words that only mean moving: a newcomer often has no card yet, so
   * the interview waits for "Carry on" and the move is answered; "I work in Bengaluru" stays an answer.
   */
  function send(text: string, via: Via) {
    if (!active) return void sendNote(text);
    const moving = movingIntent(text, lang);
    if (!moving?.certain) return answerInterview(text, via === Via.voice);
    pauseInterview();
    moves.start(text, moving.city);
  }

  return (
    <>
      <div className={C.stack}>
        <h1 className={C.headline}>
          {t("agent.headline")} <span className={C.soft}>{t("agent.soft")}</span>
        </h1>
      </div>
      {turns.length > 0 && <Interview ports={ports} account={account} onSaved={onSaved} moves={moves} />}
      {paused && (
        <div className={C.row}>
          <button type={C.button} className={C.chipOn} onClick={resumeInterview}>
            {t("iv.resume")}
          </button>
        </div>
      )}
      {ready && turns.length === 0 && !active && <Suggestions items={suggestions} />}
      <div ref={end} />
      <Dock>
        <Composer
          label={t("nav.talk")}
          placeholder={t("agent.placeholder")}
          onSend={send}
          busy={busy || moves.busy || !ready || state?.slot === Slot.done}
          hints={current?.hints ?? []}
          numeric={current?.numeric ?? false}
          onDeviceOnly={current?.secret ?? false}
        />
      </Dock>
    </>
  );
}
