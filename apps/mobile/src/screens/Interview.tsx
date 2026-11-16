import {
  areaSlug,
  askingArrangement,
  type ChatIntent,
  draftOf,
  estimateRequest,
  isLastSlot,
  type Line,
  log,
  type Ports,
  Slot,
} from "@gigsync/core";
import { QuestionKey } from "@gigsync/protocol";
import { useEffect } from "react";
import type { Account } from "../adapters/account.js";
import { cityOf } from "../adapters/cities.js";
import { offerAlerts } from "../adapters/push.js";
import { stopSpeaking } from "../adapters/speech.js";
import { claimPublish, interviewEstimate, interviewFailed, interviewPublished } from "../card/interviewStore.js";
import { AboutPrivateError, publishCard, unlistCard } from "../card/publish.js";
import { fetchEstimate } from "../estimate/useEstimate.js";
import { useI18n } from "../i18n.js";
import { isMove } from "../talk/moveTurns.js";
import { useTalk } from "../talk/talkStore.js";
import { Speaker, type Turn } from "../talk/turns.js";
import type { Moves } from "../talk/useMoves.js";
import { errorKey } from "../ui/errorKey.js";
import { AREAS } from "../ui/places.js";
import { MoveTurnView } from "./talk/AgentTurns.js";
import { Own } from "./talk/Bubbles.js";
import { CardTurn } from "./talk/CardTurn.js";
import { Note } from "./talk/NoteView.js";
import "./talk.css";

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
  const city = cityOf(state?.draft.place);
  useEffect(() => {
    const details = arrangement ? { [QuestionKey.enum.arrangement]: arrangement } : {};
    const request = trade && area ? estimateRequest(city, trade, details, areaSlug(area)) : undefined;
    if (!request) return;
    // Only the newest request's answer counts: the city's range must not land after the area's.
    let live = true;
    void fetchEstimate(session, request).then((found) => {
      if (live) interviewEstimate(found);
    });
    return () => {
      live = false;
    };
  }, [trade, area, arrangement, session, city]);

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
          typing={newestNote}
          onChoose={newestNote && !thinking ? (intent) => onChoose(turn, intent) : undefined}
        />
      );
    }
    return (
      <CardTurn
        key={turn.id}
        lines={turn.lines}
        choices={turn.choices}
        live={asking && turn.id === newest?.id ? state : undefined}
        account={account}
      />
    );
  };
  // A log, so a screen reader announces each new question, readback and answer; focus stays in the composer.
  return (
    <div className="iv" role="log" aria-live="polite">
      {turns.map(show)}
    </div>
  );
}
