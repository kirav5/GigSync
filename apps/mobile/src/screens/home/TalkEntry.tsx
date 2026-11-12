import { useId } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";

/**
 * The big way into Talk, the worker's chat with their agent, which lives under Home. Its name is "Talk to your agent"
 * alone; the line under it, what to ask, is its description.
 */
export function TalkEntry({ onTalk }: { onTalk: () => void }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <button
      type={C.button}
      className="home-talk"
      aria-labelledby={`${id}t`}
      aria-describedby={`${id}s`}
      onClick={onTalk}
    >
      <span className="home-talk-mic" aria-hidden="true">
        <Icon name="mic" size={26} />
      </span>
      <span className="home-talk-text">
        <span id={`${id}t`} className="home-talk-title">
          {t("home.talk_agent")}
        </span>
        <span id={`${id}s`} className="fine">
          {t("jobs.talk_sub")}
        </span>
      </span>
    </button>
  );
}
