import type { Arrangement } from "@gigsync/protocol";
import { togglePick } from "../../find/needStore.js";
import type { FoundTurn } from "../../find/needTurns.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { WorkerPick } from "./WorkerPick.js";

/**
 * The workers a search found, ticked to ask, and the button that asks them while the results are current. The button
 * stays in the group (screen readers hear it with the workers) but sticks to the bottom of the screen while the list
 * scrolls under it, with the promise that nothing of the owner's goes out.
 */
export function Found({
  chat,
  turn,
  active,
  busy,
  onAsk,
  arrangement,
}: {
  chat: string;
  turn: FoundTurn;
  active: boolean;
  busy: boolean;
  onAsk: (turn: FoundTurn) => void;
  /** The arrangement asked for: each worker's rate for it is shown (ADR 0046). */
  arrangement: Arrangement | undefined;
}) {
  const { t, plural } = useI18n();
  return (
    <fieldset className={`${C.stack} found`} aria-label={t("a11y.ask_workers")}>
      {turn.workers.map((w) => (
        <WorkerPick
          key={w.user}
          worker={w}
          picked={turn.picked.includes(w.user)}
          arrangement={arrangement}
          disabled={!active}
          onToggle={() => togglePick(chat, turn.id, w.user)}
        />
      ))}
      {active && (
        <div className="found-ask">
          <button
            type={C.button}
            className={`${C.wide} btn-big`}
            disabled={busy || turn.picked.length === 0}
            aria-busy={busy}
            onClick={() => onAsk(turn)}
          >
            <Icon name="arrow" />
            {plural("find.ask", turn.picked.length)}
          </button>
          <p className="fine">{t("find.ask_note")}</p>
        </div>
      )}
    </fieldset>
  );
}
