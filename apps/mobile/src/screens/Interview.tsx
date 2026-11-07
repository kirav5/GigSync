import {
  areaSlug,
  askingArrangement,
  CardPick,
  type ChatIntent,
  type Choice,
  draftOf,
  estimateRequest,
  isLastSlot,
  type Line,
  log,
  type Ports,
  prompt,
  Slot,
} from "@gigsync/core";
import { QuestionKey } from "@gigsync/protocol";
import { useEffect } from "react";
import type { Account } from "../adapters/account.js";
import { offerAlerts } from "../adapters/push.js";
import { stopSpeaking } from "../adapters/speech.js";
import {
  claimPublish,
  interviewEstimate,
  interviewFailed,
  interviewPublished,
  pauseInterview,
  placeInterview,
  tapInterview,
  toggleInterview,
} from "../card/interviewStore.js";
import { AboutPrivateError, publishCard, unlistCard } from "../card/publish.js";
import { type FoundPlace, pilotPlace, workPlace } from "../card/workPlace.js";
import { fetchEstimate } from "../estimate/useEstimate.js";
import { useI18n } from "../i18n.js";
import { isMove } from "../talk/moveTurns.js";
import { useTalk } from "../talk/talkStore.js";
import { Speaker, type Turn } from "../talk/turns.js";
import type { Moves } from "../talk/useMoves.js";
import { C } from "../ui/cls.js";
import { errorKey } from "../ui/errorKey.js";
import { AREAS, PILOT_CITY } from "../ui/places.js";
import { LocateStep } from "./address/LocateStep.js";
import { MoveTurnView } from "./talk/AgentTurns.js";
import { Ask, Own } from "./talk/Bubbles.js";
import { Note } from "./talk/NoteView.js";
import "./talk.css";

/** Between the kinds of work picked, as the owner's answer reads. */
const LIST_JOINER = ", ";

/** "Later": the voice stops with the questions, so a summary half read out does not carry on over the next screen. */
function later() {
  void stopSpeaking();
  pauseInterview();
}

/**
 * The tap answers under the newest question, and "Later", which pauses the interview. Where the choices toggle
 * (`picked`), a tap turns one on or off in place, and Done answers with all of them at once.
 */
function Choices({ choices, picked }: { choices: readonly Choice[]; picked?: readonly string[] | undefined }) {
  const { t } = useI18n();
  const toggles = picked !== undefined;
  const on = (c: Choice) => picked?.includes(c.value) ?? false;
  const done = choices.filter(on).map((c) => t(c.key, c.params));
  const tap = (c: Choice) => {
    if (toggles && c.value !== CardPick.yes) return toggleInterview(c.value);
    tapInterview(c.value, toggles && done.length > 0 ? done.join(LIST_JOINER) : t(c.key, c.params));
  };
  return (
    <div className={`${C.row} iv-choices`}>
      {choices.map((c) => (
        <button
          key={c.value}
          type={C.button}
          aria-pressed={toggles && c.value !== CardPick.yes ? on(c) : undefined}
          className={on(c) ? C.chipOn : C.chip}
          onClick={() => tap(c)}
        >
          {t(c.key, c.params)}
        </button>
      ))}
      <button type={C.button} className={`${C.chip} iv-later`} onClick={later}>
        {t("iv.later")}
      </button>
    </div>
  );
}

/** "Use my location" under the area question: for a worker whose area is not a pilot one (ADR 0045). */
function LocateArea({ session }: { session: Account["session"] }) {
  const use = (found: FoundPlace | undefined) => {
    if (found) placeInterview(found.area, found.place);
    return found !== undefined;
  };
  return (
    <LocateStep
      session={session}
      label="card.use_location"
      onFound={(place, point) => use(workPlace(place, point))}
      onPointOnly={(point) => use(pilotPlace(point))}
    />
  );
}

/**
 * Talk's conversation, in the order it happened: notes to the agent with its answers, the card interview, each
 * question with a replay button, read aloud once when it appears, the owner's answers opposite, and a move to a new
 * city as the agent answers it (`moves` acts on its buttons). When the owner says yes to the summary, the card is
 * published from here. While the agent works on the newest note, `thinking` shows it; the choices under its question
 * go to `onChoose`.
 */
export function Interview({
  ports,
  account,
  onSaved,
  moves,
  thinking,
  onChoose,
}: {
  ports: Ports;
  account: Account;
  onSaved: (a: Account) => void;
  moves: Moves;
  thinking: boolean;
  onChoose: (note: { id: number; text: string }, intent: ChatIntent) => void;
}) {
  const { lang } = useI18n();
  const { state, turns, paused } = useTalk();
  const active = state !== undefined && !paused;
  /** Choices are offered while a question is open, not once the owner has said yes and the card is being sent. */
  const asking = active && !isLastSlot(state.slot);
  const newest = [...turns].reverse().find((turn) => turn.who === Speaker.app);
  // A trade and area named: the usual range for it at its default scope in the worker's area, for the rate questions
  // (ADR 0030, ADR 0039). Asked once, when both are known, never once per answer (ADR 0041).
  const trade = state?.draft.trades?.[0];
  const area = state?.draft.area;
  // ADR 0046: the arrangement whose rate is asked now, so the estimate is in its unit.
  const arrangement = state ? askingArrangement(state) : undefined;
  const session = account.session;
  useEffect(() => {
    const details = arrangement ? { [QuestionKey.enum.arrangement]: arrangement } : {};
    const request = trade && area ? estimateRequest(PILOT_CITY, trade, details, areaSlug(area)) : undefined;
    if (!request) return;
    // Only the newest request's answer counts: the city's range must not land after the area's.
    let live = true;
    void fetchEstimate(session, request).then((found) => {
      if (live) interviewEstimate(found);
    });
    return () => {
      live = false;
    };
  }, [trade, area, arrangement, session]);

  // Leaving Talk (another screen, Back) ends a question the owner asked to hear again.
  useEffect(
    () => () => {
      void stopSpeaking();
    },
    [],
  );

  useEffect(() => {
    if (!state || !isLastSlot(state.slot)) return;
    const claim = claimPublish();
    if (claim === undefined) return;
    if (state.slot === Slot.unlisted) {
      unlistCard(ports, account)
        .then((saved) => {
          if (interviewPublished(claim, { key: "card.off_board" })) onSaved(saved);
        })
        .catch((err: unknown) => {
          log.warn("card interview unlist failed", { error: err instanceof Error ? err.message : String(err) });
          interviewFailed(claim, { key: errorKey(err) });
        });
      return;
    }
    const draft = draftOf(state);
    // Requests start to come once the card is listed: the browser may ask about notifications, if the last answer was
    // a tap a moment ago (it asks only then).
    void offerAlerts();
    publishCard(ports, account, draft, lang)
      .then((saved) => {
        const area = AREAS.find((a) => a.key === draft.area);
        const named = draft.place?.name;
        const where =
          area && !named ? { names: { area: [`area.${area.key}` as const] } } : { params: { area: named ?? "" } };
        const line: Line = { key: "iv.published", ...where };
        // Signed out while the card was on its way: the next owner hears nothing of it.
        if (!interviewPublished(claim, line)) return;
        onSaved(saved);
      })
      .catch((err: unknown) => {
        log.warn("card interview publish failed", { error: err instanceof Error ? err.message : String(err) });
        // A line kept from an older card can carry a phone number; say so, so the owner knows what to change.
        interviewFailed(claim, { key: err instanceof AboutPrivateError ? "iv.err_private" : errorKey(err) });
      });
  }, [state, ports, account, lang, onSaved]);

  const last = turns.at(-1);
  const show = (turn: Turn) => {
    if (isMove(turn)) return <MoveTurnView key={turn.id} turn={turn} newest={turn.id === last?.id} moves={moves} />;
    if (turn.who === Speaker.owner) return <Own key={turn.id} text={turn.text} />;
    if (turn.who === Speaker.note) {
      const newestNote = turn.id === last?.id;
      return (
        <Note
          key={turn.id}
          text={turn.text}
          card={turn.card}
          thinking={thinking && newestNote}
          onChoose={newestNote && !thinking ? (intent) => onChoose(turn, intent) : undefined}
        />
      );
    }
    return (
      <Ask key={turn.id} lines={turn.lines}>
        {asking && turn.id === newest?.id && <Choices choices={turn.choices} picked={state && prompt(state).picked} />}
        {asking && turn.id === newest?.id && state.slot === Slot.area && <LocateArea session={session} />}
      </Ask>
    );
  };
  // A log, so a screen reader announces each new question, readback and answer; focus stays in the composer.
  return (
    <div className="iv" role="log" aria-live="polite">
      {turns.map(show)}
    </div>
  );
}
