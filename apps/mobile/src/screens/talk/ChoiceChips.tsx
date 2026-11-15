import { CardPick, type Choice, type MessageKey } from "@gigsync/core";
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
/** The chip that ends a question answered by several taps; filled, so it reads as the way on. */
const DONE_KEY: MessageKey = "iv.done";
/** Before how many are picked, after the chip's gap: "Done · 2". */
const COUNT_JOINER = "· ";
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
 * the choices toggle (`picked`), a tap turns one on or off in place, and Done answers with all of them at once. Done is
 * always the filled chip, with how many are picked once there are any ("Done · 2"); the count is drawn, not read, so
 * the button's name stays "Done" and a screen reader hears each chip's own pressed state instead. As the UI kit lays
 * it out, the answers come first with `say` as a dashed chip after them, and Done and Finish later sit on their own
 * line underneath, so the way on is never lost among the answers.
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
  const chip = (c: Choice) => {
    const picture = workPicture(c.value);
    const isDone = c.key === DONE_KEY;
    return (
      <button
        key={c.value}
        type={C.button}
        aria-pressed={toggles && c.value !== CardPick.yes ? on(c) : undefined}
        className={isDone ? `${C.chip} iv-done` : on(c) ? C.chipOn : C.chip}
        onClick={() => tap(c)}
      >
        {picture && <Picture of={picture} />}
        {t(c.key, c.params)}
        {isDone && done.length > 0 && <span aria-hidden="true">{`${COUNT_JOINER}${done.length}`}</span>}
      </button>
    );
  };
  return (
    <div className="iv-choices">
      <div className={C.row}>
        {choices.filter((c) => c.key !== DONE_KEY).map(chip)}
        {say && (
          <button type={C.button} className={`${C.chip} iv-say-own`} onClick={sayOwn}>
            {say.icon && <Icon name={say.icon} size={PICTURE_PX} />}
            {t(say.key)}
          </button>
        )}
      </div>
      <div className={`${C.row} iv-way-on`}>
        {choices.filter((c) => c.key === DONE_KEY).map(chip)}
        <button type={C.button} className={`${C.chip} iv-later`} onClick={later}>
          {t("iv.later")}
        </button>
      </div>
    </div>
  );
}
