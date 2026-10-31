import {
  ChatIntent,
  type GigDevice,
  type Line,
  log,
  type MessageKey,
  modelJobType,
  NeedSlot,
  needPrompt,
  needRequest,
  type Ports,
  parseNeed,
  readScope,
  startNeed,
  understandNeed,
} from "@gigsync/core";
import { useEffect, useRef, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { chosenModel, ModelChoice } from "../../adapters/model.js";
import { stopSpeaking } from "../../adapters/speech.js";
import { needConfig } from "../../card/choices.js";
import { answerMarket, routedMarket } from "../../estimate/market.js";
import { fetchEstimate } from "../../estimate/useEstimate.js";
import { askedTo, askWorkers, needOf, searchBoard } from "../../find/ask.js";
import { claimSearch, startFindChat, useNeed } from "../../find/findChats.js";
import {
  answerNeed,
  beginNeed,
  jobTypeNeed,
  needAsked,
  needEstimateFound,
  needFound,
  needSay,
  needSearchFailed,
  relanguageNeed,
  showOwner,
} from "../../find/needStore.js";
import { findRoute } from "../../find/route.js";
import { usePriceQuestions } from "../../find/usePriceQuestions.js";
import { useI18n } from "../../i18n.js";
import { Composer, Via } from "../../ui/Composer.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { errorKey } from "../../ui/errorKey.js";
import { AREAS, PILOT_CITY } from "../../ui/places.js";
import { phoneDay } from "../jobGroups.js";
import { type FoundTurn, NeedTurns } from "./NeedTurns.js";
import { needMemory, withMemory } from "./remembered.js";
import "../talk.css";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  onAsked: () => void;
}

/** The phone has a usable model now: it decides the price questions (ADR 0041 §2); lite mode asks the fixed ones. */
const modelOn = () => chosenModel.answering() !== ModelChoice.lite;
const failure = (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) });
const ASKED: Line = { key: "need.asked" };
/** Said if a yes ever comes before the need is whole: the readback asks again. */
const INCOMPLETE: MessageKey = "need.again";

/**
 * Find as a conversation, the way workers make their card in Talk: the owner says what they need in their own words,
 * by voice or typing, and the agent asks only what is missing, reads it back, searches, and asks the workers they
 * pick; a chat addressed to one worker skips the search and, after the yes, asks them alone. In English, the phone's own model (when there is one) helps read the first sentence; the word lists decide.
 * Each conversation is one of the household's chats (`find/findChats.ts`); once its workers were asked it stays to
 * read, with a way to ask for something else in a new chat.
 */
export function FindChat({ ports, account, device, onAsked }: Props) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const { ready, open, state, turns, to } = useNeed();
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const current = state ? needPrompt(state) : undefined;

  // A chat with nothing in it starts a new need; one under way carries on where it was. What the agent remembers
  // from past jobs comes along, with the owner's setting: offered first ("Use it?"), or filled in and said.
  const empty = ready && !state && turns.length === 0;
  useEffect(() => {
    if (!empty) return;
    const config = needConfig(lang, phoneDay(ports.clock.now()));
    void needMemory(ports, account).then((remembered) =>
      beginNeed(open, startNeed({ ...withMemory(config, remembered), modelQuestions: modelOn() }, to)),
    );
  }, [empty, open, to, lang, ports, account]);

  // A language picked in About me part-way: the questions from here on, and what the mic listens for, follow it.
  useEffect(() => {
    if (state && state.config.own !== lang)
      relanguageNeed(open, withMemory(needConfig(lang, state.config.today), state.config.remembered));
  }, [state, open, lang]);

  useEffect(() => {
    if (turns.length > 0) end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  // Leaving Find ends a question the owner asked to hear again.
  useEffect(
    () => () => {
      void stopSpeaking();
    },
    [],
  );

  // The job as described so far, once the trade is known: the usual range for it, shown beside the budget question.
  const request = state ? needRequest(PILOT_CITY, state.draft) : undefined;
  const requestKey = request && JSON.stringify(request);
  const session = account.session;
  usePriceQuestions(ports, open, state);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the request's JSON, not its identity
  useEffect(() => {
    if (request) void fetchEstimate(session, request).then((found) => needEstimateFound(open, found));
  }, [requestKey, session, open]);

  // The owner said yes to the readback: search the board, once, wherever they are by the time it answers; or, for a
  // chat addressed to one worker, ask them.
  useEffect(() => {
    const trade = state?.draft.trade;
    if (state?.slot !== NeedSlot.done || !trade) return;
    const claim = claimSearch(open);
    if (claim === undefined) return;
    if (state.to) {
      const sent = needOf(state, i18n, ports.clock.now());
      if (!sent) return needSearchFailed(claim, INCOMPLETE);
      askWorkers(ports, device, sent, [askedTo(state.to)])
        .then(() => {
          needAsked(claim.chat, ASKED);
          onAsked();
        })
        .catch((err: unknown) => {
          log.warn("asking the worker failed", failure(err));
          needSearchFailed(claim, errorKey(err));
        });
      return;
    }
    const area = AREAS.find((a) => a.key === state.draft.area) ?? AREAS[0];
    searchBoard(account, trade, area, state.radius_km)
      .then((workers) => needFound(claim, workers))
      .catch((err: unknown) => {
        log.warn("search failed", failure(err));
        needSearchFailed(claim, errorKey(err));
      });
  }, [state, open, account, i18n, ports, device, onAsked]);

  // The first answer, the need in the owner's words: in English the phone's model helps read it, and in every
  // language its scope is read into chips the owner confirms before the estimate is asked (ADR 0033 §5).
  async function send(text: string, via: Via) {
    if (!state || busy || reading) return;
    const chat = open;
    const aloud = via === Via.voice;
    const first = state.slot === NeedSlot.trade;
    if (first) {
      showOwner(chat, text);
      setReading(true);
    }
    const route = await findRoute(ports, lang, text, state.slot);
    // "What do painters charge?" is answered in the chat from the estimate route (ADR 0039 §2); the need waits.
    const market = route.intent === ChatIntent.market ? routedMarket(text, route.slots) : undefined;
    if (market) {
      if (!first) showOwner(chat, text);
      setReading(true);
      const answer = await answerMarket(account.session, ports.model, lang, market);
      setReading(false);
      return needSay(chat, { key: "estimate.answer", params: { text: answer.text } });
    }
    if (!first) return answerNeed(chat, text, aloud);
    const { areas, today } = state.config;
    const hint = await understandNeed(ports.model, text, { areas, lang });
    const trade = parseNeed(text, { areas, today }).trade ?? hint.trade ?? state.draft.trade;
    // Outside the trades, the phone's model may name the work, and the need goes on to its questions and estimate.
    const jobType = !trade && state.draft.modelAsk ? await modelJobType(ports.model, text, lang) : undefined;
    if (jobType) {
      setReading(false);
      return jobTypeNeed(chat, jobType, text);
    }
    const scope = trade ? await readScope(ports.model, text, { trade, lang }) : [];
    setReading(false);
    answerNeed(chat, text, aloud, { ...hint, scope }, true);
  }

  async function ask(turn: FoundTurn) {
    const need = state && needOf(state, i18n, ports.clock.now());
    if (busy || !need) return;
    const chat = open;
    setBusy(true);
    try {
      await askWorkers(
        ports,
        device,
        need,
        turn.workers.filter((w) => turn.picked.includes(w.user)),
      );
      needAsked(chat, ASKED);
      onAsked();
    } catch (err) {
      log.warn("asking workers failed", failure(err));
      needSay(chat, { key: errorKey(err) });
    } finally {
      setBusy(false);
    }
  }

  const conversation = (
    <NeedTurns chat={open} state={state} turns={turns} busy={busy} onAsk={(turn) => void ask(turn)} />
  );
  // The workers were asked: the chat stays to read, and asking for something else opens a new one.
  if (ready && !state && turns.length > 0)
    return (
      <>
        {conversation}
        <div ref={end} />
        <Dock>
          <button type={C.button} className={C.wide} onClick={() => startFindChat()}>
            {t("chats.new_need")}
          </button>
        </Dock>
      </>
    );
  const waiting =
    !state || state.slot === NeedSlot.done || state.slot === NeedSlot.found || state.slot === NeedSlot.outside;
  return (
    <>
      {conversation}
      {reading && (
        <p className={C.muted} role="status">
          {t("need.reading")}
        </p>
      )}
      <div ref={end} />
      <Dock>
        <Composer
          label={t("need.composer")}
          placeholder={t("need.placeholder")}
          onSend={(text, via) => void send(text, via)}
          busy={busy || reading || waiting}
          hints={current?.hints ?? []}
          numeric={current?.numeric ?? false}
          onDeviceOnly={current?.secret ?? false}
        />
      </Dock>
    </>
  );
}
