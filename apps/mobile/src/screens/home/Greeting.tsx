import type { MessageKey } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import "./greeting.css";

/** Between the words of a name: the greeting uses the first. */
const WORDS = /\s+/;

/** One chip under the greeting: its line icon, its short words (its name, exactly), and what it starts. */
export interface GreetingRow {
  icon: IconName;
  label: MessageKey;
  onPick: () => void;
}

interface Props {
  /** The owner's name, as they gave it; the greeting says the first word of it. */
  name: string;
  /** The muted line under the greeting: what Home is for. */
  line: MessageKey;
  rows: readonly GreetingRow[];
}

/**
 * Home's greeting while its chat is empty (the design's Home): "Namaste" and the owner's first name in the serif with
 * the terracotta-to-gold text gradient, a muted line, and a few short white chips that wrap, each starting what it
 * says. It goes with the first message, as other assistants' do; voice and typing do the same and more.
 */
export function Greeting({ name, line, rows }: Props) {
  const { t } = useI18n();
  const first = name.trim().split(WORDS)[0] ?? name;
  return (
    <section className="greet" aria-label={t("tabs.namaste", { name: first })}>
      <h1 className="greet-hi">{t("tabs.namaste", { name: first })}</h1>
      <p className="greet-line">{t(line)}</p>
      <div className="greet-chips">
        {rows.map(({ icon, label, onPick }) => (
          <button key={label} type={C.button} className="greet-chip" onClick={onPick}>
            <Icon name={icon} size={16} />
            {t(label)}
          </button>
        ))}
      </div>
    </section>
  );
}
