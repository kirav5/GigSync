import {
  DayWord,
  draftDetails,
  type GigDevice,
  type Line,
  log,
  NeedSlot,
  needPrompt,
  needToSend,
  needWords,
  type Ports,
  resolveDay,
  startNeed,
  understandNeed,
} from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { useEffect, useRef, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { readAloud, stopSpeaking } from "../../adapters/speech.js";
import { needConfig } from "../../card/choices.js";
import { askWorkers, dayLabel, searchBoard } from "../../find/ask.js";
import {
  answerNeed,
  beginNeed,
  claimSearch,
  NeedSpeaker,
  needAsked,
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
import { AREAS } from "../../ui/places.js";
import { phoneDay } from "../jobGroups.js";
import { lineText, spoken } from "../talk/Bubbles.js";
import { type FoundTurn, NeedTurns } from "./NeedTurns.js";
import "../talk.css";

/** The language the phone's model reads; other languages go by the word lists alone. */
const MODEL_LANG = Lang.enum.en;

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  /** A worker hiring a helper: their asks are followed on Today, not My jobs. */
  hire: boolean;
  onAsked: () => void;
}

const failure = (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) });

/**
 * Find as a conversation, the way workers make their card in Talk: the owner says what they need in their own words,
 * by voice or typing, and the agent asks only what is missing, reads it back, searches, and asks the workers they
 * pick. In English, the phone's own model (when there is one) helps read the first sentence; the word lists decide.
 */
export function FindChat({ ports, account, device, hire, onAsked }: Props) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const { state, turns } = useNeed();
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const opened = useRef(false);
  /** The workers were asked: the last line plays on while My jobs opens. */
  const leaving = useRef(false);
  const heard = useRef<number>(undefined);
  const end = useRef<HTMLDivElement>(null);
  const current = state ? needPrompt(state) : undefined;
  const newest = [...turns].reverse().find((turn) => turn.who === NeedSpeaker.app);

  // Opening Find starts a new need, unless one is under way; it carries on where it was.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (!state) beginNeed(startNeed(needConfig(lang, phoneDay(ports.clock.now()))));
  }, [state, lang, ports]);

  // A language picked in Profile part-way: the questions from here on, and what the mic listens for, follow it.
  useEffect(() => {
    if (state && state.config.own !== lang) relanguageNeed(needConfig(lang, state.config.today));
  }, [state, lang]);

  useEffect(() => {
    if (turns.length > 0) end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  // Each question is read aloud once, when it appears.
  useEffect(() => {
    if (!state || newest?.who !== NeedSpeaker.app || heard.current === newest.id) return;
    heard.current = newest.id;
    void readAloud(lang, spoken(i18n, newest.lines));
  }, [state, newest, lang, i18n]);

  useEffect(
    () => () => {
      if (!leaving.current) void stopSpeaking();
    },
    [],
  );

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

  async function send(text: string, via: Via) {
    if (!state || busy) return;
    const aloud = via === Via.voice;
    if (state.slot !== NeedSlot.trade || lang !== MODEL_LANG) return answerNeed(text, aloud);
    showOwner(text);
    setReading(true);
    const hint = await understandNeed(ports.model, text, { areas: state.config.areas, lang });
    setReading(false);
    answerNeed(text, aloud, hint, true);
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
    });
    setBusy(true);
    try {
      await askWorkers(ports, device, need, turn.workers, turn.picked);
      const line: Line = { key: hire ? "need.asked_hire" : "need.asked" };
      needAsked(line);
      leaving.current = true;
      void readAloud(lang, lineText(i18n, line));
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
