import { useI18n } from "../i18n.js";
import { C } from "./cls.js";

/** The three dots that say the phone is at it, the same everywhere: in a chat, on a card, by a button. */
export function Dots() {
  return (
    <span className="thinking-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

/**
 * A wait, said on the screen and to a screen reader: the line is always in the page, so a reader hears it fill, and
 * takes no room while empty. `words` names the wait when it has a name of its own.
 */
export function Working({ on, words }: { on: boolean; words?: string }) {
  const { t } = useI18n();
  return (
    <p className="working" role="status">
      {on && (
        <>
          <Dots />
          <span className={C.faint}>{words ?? t("busy.working")}</span>
        </>
      )}
    </p>
  );
}
