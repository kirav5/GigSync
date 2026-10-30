import { useI18n } from "../../i18n.js";
import { type ActChoice, MoveSpeaker, type MoveTurn } from "../../talk/moveTurns.js";
import type { Moves } from "../../talk/useMoves.js";
import { C } from "../../ui/cls.js";
import { areaLabel } from "../../ui/places.js";
import { MentorFacts } from "../mentor/MentorFacts.js";
import "../mentor/mentor.css";
import { lineText } from "./Bubbles.js";
import { AgentLines, GuideView, MovingView, OutlookView } from "./MoveTurns.js";

/**
 * The agent's turns in a chat about a move: its short questions with tap answers, the mentors it found as cards with
 * Ask, and the move's own turns (`MoveTurns.tsx`). A question's chips work only while it is the chat's newest turn;
 * the move's buttons and a mentor's Ask work wherever they are.
 */

type Of<W extends MoveTurn["who"]> = Extract<MoveTurn, { who: W }>;

/** The chips under the agent's newest question; on a question that takes several, the picked ones show as on. */
function ActChips({ choices, moves }: { choices: readonly ActChoice[]; moves: Moves }) {
  const i18n = useI18n();
  return (
    <div className={`${C.row} iv-choices`}>
      {choices.map((c) => {
        const label = lineText(i18n, c.label);
        return (
          <button
            key={JSON.stringify(c.act)}
            type={C.button}
            className={c.on ? C.chipOn : C.chip}
            aria-pressed={c.on === undefined ? undefined : c.on}
            disabled={moves.busy}
            onClick={() => moves.act(c.act, label)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Up to three mentors the match returned, each with their own count, the vouched badge, and Ask. */
function MentorsView({ turn, moves }: { turn: Of<typeof MoveSpeaker.mentors>; moves: Moves }) {
  const { lang, t } = useI18n();
  return (
    <ul className="mentor-results" aria-label={t("moving.find")}>
      {turn.mentors.map((m) => {
        const ask = t("moving.ask", { name: m.first_name });
        return (
          <li key={m.user} className={C.card}>
            <strong>{m.first_name}</strong>
            <MentorFacts facts={{ ...m, area: areaLabel(lang, m.area) }} />
            <button
              type={C.button}
              className={C.chip}
              disabled={moves.busy}
              onClick={() => moves.ask(m, ask, turn.city)}
            >
              {ask}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** One of a move's turns, by its kind; `newest` says whether it is the chat's newest turn. */
export function MoveTurnView({ turn, newest, moves }: { turn: MoveTurn; newest: boolean; moves: Moves }) {
  switch (turn.who) {
    case MoveSpeaker.moving:
      return <MovingView turn={turn} moves={moves} />;
    case MoveSpeaker.outlook:
      return <OutlookView turn={turn} />;
    case MoveSpeaker.guide:
      return <GuideView answer={turn.answer} moves={moves} />;
    case MoveSpeaker.mentors:
      return <MentorsView turn={turn} moves={moves} />;
    case MoveSpeaker.agent:
      return (
        <AgentLines lines={turn.lines}>
          {newest && turn.choices.length > 0 && <ActChips choices={turn.choices} moves={moves} />}
        </AgentLines>
      );
  }
}
