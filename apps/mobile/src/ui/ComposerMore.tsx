import { useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";
import { Icon, type IconName } from "./Icon.js";
import { Sheet } from "./Sheet.js";

/** One of the owner's quick picks behind the composer's "+": its line icon, its words, and what it starts. */
export interface ComposerPick {
  icon: IconName;
  label: string;
  onPick: () => void;
}

/** The "+" icon's size, as the design's composer draws it. */
const PLUS_PX = 22;
const ROW_ICON_PX = 20;

/**
 * The composer's "+" (the design's Home): a sheet of the owner's quick picks, so what used to stand above the chat
 * (Pick from a list; change my card, my price, get verified) is a tap away without taking the screen. A pick closes
 * the sheet and then starts.
 */
export function ComposerMore({ picks, disabled }: { picks: readonly ComposerPick[]; disabled: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const only = picks.length === 1 ? picks[0] : undefined;
  // One pick (a household's "Add a photo"): the "+" is that pick, as an AI app's "+" opens the photos at once.
  if (only)
    return (
      <button
        type={C.button}
        className="composer-icon"
        aria-label={only.label}
        disabled={disabled}
        onClick={only.onPick}
      >
        <Icon name="plus" size={PLUS_PX} />
      </button>
    );
  return (
    <>
      <button
        type={C.button}
        className="composer-icon"
        aria-label={t("composer.more")}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" size={PLUS_PX} />
      </button>
      {open && (
        <Sheet title={t("composer.more_title")} onClose={() => setOpen(false)}>
          {picks.map(({ icon, label, onPick }) => (
            <button
              key={label}
              type={C.button}
              className="composer-pick"
              onClick={() => {
                setOpen(false);
                onPick();
              }}
            >
              <Icon name={icon} size={ROW_ICON_PX} />
              {label}
            </button>
          ))}
        </Sheet>
      )}
    </>
  );
}
