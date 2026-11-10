import {
  addressAsked,
  addressChoice,
  askingFirst,
  askingModel,
  categoryPicked,
  chipsOnlyNeed,
  findEventOf,
  type GigDevice,
  hearNeed,
  isGreeting,
  log,
  NeedSay,
  NeedSlot,
  needPrompt,
  needRequest,
  type Ports,
  problemByMeaning,
  startNeed,
} from "@gigsync/core";
import { FindEvent } from "@gigsync/protocol";
import { useEffect, useRef, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { cityOf, rememberHome, useServedCities } from "../../adapters/cities.js";
import { meaningFor } from "../../adapters/meaning.js";
import { chosenModel } from "../../adapters/model.js";
import { offerAlerts } from "../../adapters/push.js";
import { stopSpeaking } from "../../adapters/speech.js";
import { needConfig } from "../../card/choices.js";
import { fetchEstimate } from "../../estimate/useEstimate.js";
import { openAddressDesk } from "../../find/addressDesk.js";
import { askWorkers, needOf, whereOf } from "../../find/ask.js";
import { countFind } from "../../find/counts.js";
import { startFindChat, useNeed } from "../../find/findChats.js";
import {
  addressInUseNeed,
  answerNeed,
  beginNeed,
  leaveSwitch,
  needAsked,
  needEstimateFound,
  needSay,
  relanguageNeed,
  showOwner,
} from "../../find/needStore.js";
import { pickKind, readFirst, readLater } from "../../find/readNeed.js";
import { useAddressBook } from "../../find/useAddressBook.js";
import { useAddresses } from "../../find/useAddresses.js";
import { useListedRates } from "../../find/useListedRates.js";
import { useNeedInput } from "../../find/useNeedInput.js";
import { ASKED, useNeedSearch } from "../../find/useNeedSearch.js";
import { useFirstQuestion, usePriceQuestions } from "../../find/usePriceQuestions.js";
import { useI18n } from "../../i18n.js";
import { Via } from "../../ui/Composer.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { errorKey } from "../../ui/errorKey.js";
import { phoneDay } from "../jobGroups.js";
import { AddAddress } from "./AddAddress.js";
import { AddressDesk } from "./AddressDesk.js";
import { NeedDock } from "./NeedDock.js";
import { type FoundTurn, NeedTurns } from "./NeedTurns.js";
import { needMemory, withMemory } from "./remembered.js";
import "../talk.css";
import { Working } from "../../ui/Working.js";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  onAsked: () => void;
}

const failure = (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) });

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
  const { saved, added } = useAddresses(ports, open, state?.config.addresses);
  const { inUse } = useAddressBook(ports.storage);
  const inUseId = inUse?.id;
  const [adding, setAdding] = useState(false);
  // The address at the top of the screen comes first at the "where" question, a tap away.
  useEffect(() => {
    if (state && state.config.inUse !== inUseId) addressInUseNeed(open, inUseId);
  }, [state, open, inUseId]);
  // A yes to other work part-way: this chat stays in the list, and the words open their own.
  const carried = useRef<string | undefined>(undefined);
  // Words on their way to be read, typed or carried over, are read as they are even if the model has just gone.
  const typing = useNeedInput(open, state, reading || carried.current !== undefined);
  useEffect(() => {
    if (!state?.switching?.accepted) return;
    carried.current = state.switching.words;
    leaveSwitch(open);
    startFindChat();
  }, [state, open]);
  useEffect(() => {
    if (!empty || !saved) return;
    const now = ports.clock.now();
    const config = { ...needConfig(lang, phoneDay(now)), hour: now.getHours(), addresses: saved.map(addressChoice) };
    // Whether GigSync's model is there is known first: with no model to read words, the need opens on the list.
    void Promise.all([needMemory(ports, account), chosenModel.server.ready()]).then(([remembered]) => {
      const reads = chosenModel.reads();
      const need = startNeed({ ...withMemory(config, remembered), modelQuestions: reads }, to);
      beginNeed(open, reads || carried.current ? need : chipsOnlyNeed(need));
    });
  }, [empty, open, to, lang, ports, account, saved]);

  // A language picked in About me part-way: the questions from here on, and what the mic listens for, follow it.
  useEffect(() => {
    if (state && state.config.own !== lang)
      relanguageNeed(open, {
        ...withMemory(needConfig(lang, state.config.today), state.config.remembered),
        hour: state.config.hour,
        ...(state.config.addresses ? { addresses: state.config.addresses } : {}),
      });
  }, [state, open, lang]);

  // Only a new turn scrolls the chat down: ticking a worker rewrites its turn, and must leave the list where it is.
  useEffect(() => {
    if (turns.length > 0) end.current?.scrollIntoView({ block: "end" });
  }, [turns.length]);

  // Leaving Find ends a question the owner asked to hear again.
  useEffect(
    () => () => {
      void stopSpeaking();
    },
    [],
  );

  // The job as described so far, once the trade is known: the usual range for it, shown beside the budget question.
  // The city is the chosen address's (ADR 0061): its own jobs and rate card, Bengaluru's only in Bengaluru.
  useServedCities(account.session);
  const at = state && whereOf(state.draft, saved ?? [])?.area;
  rememberHome(at);
  const city = cityOf(at);
  const request = state ? needRequest(city, state.draft) : undefined;
  const requestKey = request && JSON.stringify(request);
  const session = account.session;
  usePriceQuestions(ports, open, state);
  useFirstQuestion(ports, open, state);
  useListedRates(session, open, state, saved);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the request's JSON, not its identity
  useEffect(() => {
    if (request) void fetchEstimate(session, request).then((found) => needEstimateFound(open, found));
  }, [requestKey, session, open]);

  useNeedSearch({ state, open, account, i18n, ports, device, onAsked, saved });

  // Every message: read by the model where one is there, else the word lists (`find/readNeed.ts`). The first is the
  // need in the owner's words; its scope is read into chips the owner confirms before the estimate (ADR 0033 §5).
  async function send(text: string, via: Via) {
    if (!state || busy || reading) return;
    const chat = open;
    // "Change my address", "नया पता जोड़ो": the address turn opens in the chat, whatever was being asked (ADR 0050 §6).
    if (addressAsked(text)) {
      showOwner(chat, text);
      return openAddressDesk();
    }
    const aloud = via === Via.voice;
    // At a need outside the list, new words start over: they are read like the first sentence.
    const first = state.slot === NeedSlot.trade || state.slot === NeedSlot.outside;
    const message = { ports, session: account.session, state, chat, text, aloud, lang };
    if (first) {
      showOwner(chat, text);
      if (isGreeting(text)) return needSay(chat, { key: NeedSay.greeting });
      countFind(account.session, FindEvent.enum.typed);
      setReading(true);
      return void (await readFirst(message).finally(() => setReading(false)));
    }
    // At the clarifying question, the kind of job the answer sounds like fills the price driver (ADR 0042).
    const meaning = meaningFor(ports);
    const asked = state.slot === NeedSlot.detail ? state.draft.trade : undefined;
    const problemKind = asked && meaning ? await problemByMeaning(meaning.problems, asked, text) : undefined;
    const hint = problemKind ? { problemKind } : {};
    setReading(true);
    const taken = await readLater(message, current?.secret ?? false, hearNeed(state, text, aloud, hint)).finally(() =>
      setReading(false),
    );
    if (!taken) answerNeed(chat, text, aloud, hint);
  }

  useEffect(() => {
    const words = carried.current;
    if (!words || !state?.fresh) return;
    carried.current = undefined;
    void send(words, Via.typed);
  });

  async function ask(turn: FoundTurn) {
    // Asking workers is when this household starts to have news to hear about: the browser may ask, once.
    void offerAlerts();
    const need = state && needOf(state, i18n, ports.clock.now(), saved);
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
    <NeedTurns
      chat={open}
      state={state}
      turns={turns}
      busy={busy}
      onAsk={(turn) => void ask(turn)}
      onAddAddress={() => setAdding(true)}
      onTap={(value, label) => {
        if (state) countFind(account.session, findEventOf(state, value));
        const kind = categoryPicked(value);
        if (!kind || !state) return false;
        void pickKind(
          { ports, session: account.session, state, chat: open, text: label, aloud: false, lang },
          kind,
          label,
        );
        return true;
      }}
    />
  );
  const desk = (
    <AddressDesk
      ports={ports}
      session={account.session}
      added={(a) => added(open, a)}
      said={(line) => needSay(open, line)}
    />
  );
  const form = adding && (
    <AddAddress chat={open} session={account.session} ports={ports} added={added} onDone={() => setAdding(false)} />
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
  const thinking = state !== undefined && (askingModel(state) || askingFirst(state));
  const waiting = !state || state.slot === NeedSlot.done || state.slot === NeedSlot.found || thinking;
  return (
    <>
      {conversation}
      {desk}
      {form}
      <Working on={reading} words={t("need.reading")} />
      <Working on={thinking} words={t("driver.thinking")} />
      <Working on={state?.slot === NeedSlot.done} />
      <div ref={end} />
      <NeedDock
        {...typing}
        prompt={current}
        busy={busy || reading || waiting}
        onSend={(text, via) => void send(text, via)}
        onNumber={(digits) => answerNeed(open, digits, false)}
      />
    </>
  );
}
