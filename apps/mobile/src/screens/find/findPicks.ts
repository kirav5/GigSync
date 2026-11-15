import { NeedPick, NeedSlot, type NeedState } from "@gigsync/core";
import { tapNeed } from "../../find/needStore.js";
import { useI18n } from "../../i18n.js";
import type { ComposerPick } from "../../ui/ComposerMore.js";

/**
 * A household's quick picks behind the composer's "+": the list of work while the need's work is still to say (what
 * the opening's "Pick from a list" chip did, ADR 0051), and the saved places.
 */
export function useFindPicks(chat: string, state: NeedState | undefined, onPlaces: () => void): ComposerPick[] {
  const { t } = useI18n();
  const list = t("need.pick_work");
  const choosing = state?.slot === NeedSlot.trade && !state.to;
  return [
    ...(choosing ? [{ icon: "jobs", label: list, onPick: () => tapNeed(chat, NeedPick.list, list) } as const] : []),
    { icon: "pin", label: t("home.my_places"), onPick: onPlaces },
  ];
}
