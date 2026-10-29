import {
  DayWord,
  draftDetails,
  type GigDevice,
  type Line,
  log,
  NeedSlot,
  type NeedState,
  needDetails,
  needEstimate,
  needPrompt,
  needRequest,
  needTerms,
  needToSend,
  needWords,
  type Ports,
  parseNeed,
  perJob,
  readScope,
  resolveDay,
  startNeed,
  understandNeed,
} from "@gigsync/core";
import { useEffect, useRef, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { stopSpeaking } from "../../adapters/speech.js";
import { needConfig } from "../../card/choices.js";
import { fetchEstimate } from "../../estimate/useEstimate.js";
import { askWorkers, dayLabel, searchBoard } from "../../find/ask.js";
import {
  answerNeed,
  beginNeed,
  claimSearch,
  needAsked,
  needEstimateFound,
  needFound,
  needSay,
  needSearchFailed,
  relanguageNeed,
  showOwner,
  useNeed,
} from "../../find/needStore.js";
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

const failure = (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) });

/** The estimate the owner saw beside the budget, for the whole job, kept with the need for notes on far-off offers. */
const estimateFor = (state: NeedState) => {
  const found = needEstimate(state);
  return found && perJob(found.estimate, needDetails(state.draft));
};

/**
 * Find as a conversation, the way workers make their card in Talk: the owner says what they need in their own words,
 * by voice or typing, and the agent asks only what is missing, reads it back, searches, and asks the workers they
 * pick. In English, the phone's own model (when there is one) helps read the first sentence; the word lists decide.
 */
export function FindChat({ ports, account, device, onAsked }: Props) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const { state, turns } = useNeed();
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const opened = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const current = state ? needPrompt(state) : undefined;

  // Opening Find starts a new need, unless one is under way; it carries on where it was. What the agent remembers
  // from past jobs comes along, with the owner's setting: offered first ("Use it?"), or filled in and said.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (state) return;
    const config = needConfig(lang, phoneDay(ports.clock.now()));
    void needMemory(ports, account).then((remembered) => beginNeed(startNeed(withMemory(config, remembered))));
  }, [state, lang, ports, account]);

  // A language picked in Profile part-way: the questions from here on, and what the mic listens for, follow it.
  useEffect(() => {
    if (state && state.config.own !== lang)
      relanguageNeed(withMemory(needConfig(lang, state.config.today), state.config.remembered));
  }, [state, lang]);

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
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the request's JSON, not its identity
  useEffect(() => {
    if (request) void fetchEstimate(session, request).then(needEstimateFound);
  }, [requestKey, session]);

  // The owner said yes to the readback: search the board, once, wherever they are by the time it answers.
  useEffect(() => {
    const trade = state?.draft.trade;
    if (state?.slot !== NeedSlot.done || !trade) return;
    const claim = claimSearch();
    if (claim === undefined) return;
    const area = AREAS.find((a) => a.key === state.draft.area) ?? AREAS[0];
    searchBoard(account, trade, area, state.radius_km)
      .then((workers) => needFound(claim, workers))
      .catch((err: unknown) => {
        log.warn("search failed", failure(err));
        needSearchFailed(claim, errorKey(err));
      });
  }, [state, account]);

  // The first answer, the need in the owner's words: in English the phone's model helps read it, and in every
  // language its scope is read into chips the owner confirms before the estimate is asked (ADR 0033 §5).
  async function send(text: string, via: Via) {
    if (!state || busy) return;
    const aloud = via === Via.voice;
    if (state.slot !== NeedSlot.trade) return answerNeed(text, aloud);
    showOwner(text);
    setReading(true);
    const { areas, today } = state.config;
    const hint = await understandNeed(ports.model, text, { areas, lang });
    const trade = parseNeed(text, { areas, today }).trade ?? hint.trade ?? state.draft.trade;
    const scope = trade ? await readScope(ports.model, text, { trade, lang }) : [];
    setReading(false);
    answerNeed(text, aloud, { ...hint, scope }, true);
  }

  async function ask(turn: FoundTurn) {
    const d = state?.draft;
    const area = AREAS.find((a) => a.key === d?.area);
    if (busy || !state || !d?.trade || !area || d.budget_paise === undefined) return;
    const now = ports.clock.now();
    const day = resolveDay(d.day ?? DayWord.today, now, -now.getTimezoneOffset());
    const need = needToSend({
      trade: d.trade,
      need: needWords(d, state.config.own),
      day,
      label: dayLabel(i18n, day),
      time: d.time,
      details: draftDetails(d),
      budget_paise: d.budget_paise,
      area,
      estimate: estimateFor(state),
      terms: needTerms(d, d.trade, day),
    });
    setBusy(true);
    try {
      await askWorkers(ports, device, need, turn.workers, turn.picked);
      const line: Line = { key: "need.asked" };
      needAsked(line);
      onAsked();
    } catch (err) {
      log.warn("asking workers failed", failure(err));
      needSay({ key: errorKey(err) });
    } finally {
      setBusy(false);
    }
  }

  const waiting = !state || state.slot === NeedSlot.done || state.slot === NeedSlot.found;
  return (
    <>
      <NeedTurns state={state} turns={turns} busy={busy} onAsk={(turn) => void ask(turn)} />
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
