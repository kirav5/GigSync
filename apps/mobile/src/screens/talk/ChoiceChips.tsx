import { CardPick, type Choice } from "@gigsync/core";
import { stopSpeaking } from "../../adapters/speech.js";
import { pauseInterview, tapInterview, toggleInterview } from "../../card/interviewStore.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { type WorkPicture, workPicture } from "../../ui/workIcons.js";
import type { SayChip } from "./cardAsk.js";

/** Between the kinds of work picked, as the owner's answer reads. */
const LIST_JOINER = ", ";
/** A chip's picture, a little smaller than a button's icon. */
const PICTURE_PX = 18;
/** The composer's field in the dock, where an answer in the owner's own words goes. */
const COMPOSER_FIELD = ".composer input";

/** "Later": the voice stops with the questions, so a summary half read out does not carry on over the next screen. */
function later() {
  void stopSpeaking();
  pauseInterview();
}

/** "Something else": the answer is the owner's own words, so the field takes them (and the phone's keyboard opens). */
function sayOwn() {
  document.querySelector<HTMLInputElement>(COMPOSER_FIELD)?.focus();
}

/** A trade's picture: the kit's icon, or the drawing `ui/workIcons.ts` keeps for a trade the kit has none for. */
function Picture({ of }: { of: WorkPicture }) {
  if ("icon" in of) return <Icon name={of.icon} size={PICTURE_PX} />;
  return (
    <svg className="ic" viewBox="0 0 24 24" width={PICTURE_PX} height={PICTURE_PX} aria-hidden="true">
      <path d={of.path} />
    </svg>
  );
}

/**
 * The tap answers under the newest question, as picture chips where the answer is a trade (W1); `say`, when given, is
 * one more chip that hands the answer to the composer; and "Finish later", quieter, which pauses the interview. Where
 * the choices toggle (`picked`), a tap turns one on or off in place, and Done answers with all of them at once.
 */
export function Choices({
  choices,
  picked,
  say,
}: {
  choices: readonly Choice[];
  picked?: readonly string[] | undefined;
  say?: SayChip | undefined;
}) {
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
      {choices.map((c) => {
        const picture = workPicture(c.value);
        return (
          <button
            key={c.value}
            type={C.button}
            aria-pressed={toggles && c.value !== CardPick.yes ? on(c) : undefined}
            className={on(c) ? C.chipOn : C.chip}
            onClick={() => tap(c)}
          >
            {picture && <Picture of={picture} />}
            {t(c.key, c.params)}
          </button>
        );
      })}
      {say && (
        <button type={C.button} className={C.chip} onClick={sayOwn}>
          {say.icon && <Icon name={say.icon} size={PICTURE_PX} />}
          {t(say.key)}
        </button>
      )}
      <button type={C.button} className={`${C.chip} iv-later`} onClick={later}>
        {t("iv.later")}
      </button>
    </div>
  );
}
