import type { MessageKey } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { Greeting, type GreetingRow } from "../home/Greeting.js";

/** The common needs the greeting offers, each said into the chat as the owner's own first words. */
const NEEDS: readonly { icon: GreetingRow["icon"]; label: MessageKey }[] = [
  { icon: "pot", label: "home.suggest_cook" },
  { icon: "broom", label: "home.suggest_clean" },
];

interface Props {
  name: string;
  /** Says the words into the chat, as if typed. */
  onSay: (text: string) => void;
  /** Opens the saved places. */
  onPlaces: () => void;
}

/** An empty Find (a household's Home): the design's greeting, two common needs that start the chat, and My places. */
export function FindStart({ name, onSay, onPlaces }: Props) {
  const { t } = useI18n();
  const rows: GreetingRow[] = [
    ...NEEDS.map(({ icon, label }) => ({ icon, label, onPick: () => onSay(t(label)) })),
    { icon: "pin", label: "home.my_places", onPick: onPlaces },
  ];
  return <Greeting name={name} line="home.ask_household" rows={rows} />;
}
