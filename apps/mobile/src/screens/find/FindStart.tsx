import { type MessageKey, NeedPick } from "@gigsync/core";
import type { ReactNode } from "react";
import { tapNeed } from "../../find/needStore.js";
import { useI18n } from "../../i18n.js";
import { Greeting, type GreetingRow } from "../home/Greeting.js";

/** The common needs the greeting offers, each said into the chat as the owner's own first words. */
const NEEDS: readonly { icon: GreetingRow["icon"]; label: MessageKey }[] = [
  { icon: "pot", label: "home.suggest_cook" },
  { icon: "broom", label: "home.suggest_clean" },
];

interface Props {
  /** The open chat, which "Pick from a list" opens the list in. */
  chat: string;
  name: string;
  /** Says the words into the chat, as if typed. */
  onSay: (text: string) => void;
  /** Opens the saved places. */
  onPlaces: () => void;
  /** The household's latest jobs, under the greeting. */
  recent?: ReactNode;
}

/**
 * An empty Find (a household's Home): the design's greeting, two common needs that start the chat, the list of work,
 * and My places.
 */
export function FindStart({ chat, name, onSay, onPlaces, recent }: Props) {
  const { t } = useI18n();
  const rows: GreetingRow[] = [
    ...NEEDS.map(({ icon, label }) => ({ icon, label, onPick: () => onSay(t(label)) })),
    // The list of work, for whoever cannot say or type it (ADR 0051); it was behind the "+", which is photos now.
    { icon: "search", label: "need.pick_work", onPick: () => tapNeed(chat, NeedPick.list, t("need.pick_work")) },
    { icon: "pin", label: "home.my_places", onPick: onPlaces },
  ];
  return (
    <>
      <Greeting name={name} line="home.ask_household" rows={rows} />
      {recent}
    </>
  );
}
