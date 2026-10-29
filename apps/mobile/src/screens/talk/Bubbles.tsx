import type { Line } from "@gigsync/core";
import type { EstimateSource } from "@gigsync/protocol";
import type { ReactNode } from "react";
import { type I18n, useI18n } from "../../i18n.js";
import { money } from "../../ui/places.js";
import { SpeakButton } from "../../ui/SpeakButton.js";
import { Sources } from "../estimate/Sources.js";
import { dayDate } from "../jobGroups.js";

/**
 * The pieces of a conversation with the agent, shared by Talk's card interview and Find's chat: the agent's lines with
 * a replay button, and the owner's own words opposite.
 */

/**
 * A line in the owner's language as it is now: its prices as rupees, its names (trades, an area) and its dates in that
 * language.
 */
export function lineText({ t, date }: Pick<I18n, "t" | "date">, line: Line): string {
  const prices = Object.fromEntries(Object.entries(line.prices ?? {}).map(([name, paise]) => [name, money(paise)]));
  const names = Object.fromEntries(
    Object.entries(line.names ?? {}).map(([name, keys]) => [name, keys.map((k) => t(k)).join(", ")]),
  );
  const dates = Object.fromEntries(Object.entries(line.dates ?? {}).map(([name, day]) => [name, date(dayDate(day))]));
  return t(line.key, { ...line.params, ...prices, ...names, ...dates });
}

/** What is read aloud: every line but the silent ones (a private amount, unless the owner just said it aloud). */
export const spoken = (i18n: Pick<I18n, "t" | "date">, lines: readonly Line[]) =>
  lines
    .filter((l) => !l.silent)
    .map((l) => lineText(i18n, l))
    .join(" ");

/** The owner's own words, on their side of the conversation. */
export function Own({ text }: { text: string }) {
  return (
    <div className="msg-user">
      <div className="bubble">{text}</div>
    </div>
  );
}

/**
 * A question or readback, with its replay button; the silent lines are shown but never spoken. An estimate among the
 * lines has its sources folded under them.
 */
export function Ask({
  lines,
  sources,
  children,
}: {
  lines: readonly Line[];
  sources?: readonly EstimateSource[] | undefined;
  children?: ReactNode;
}) {
  const i18n = useI18n();
  return (
    <div className="msg-agent iv-ask">
      <div className="iv-say">
        <div className="text">
          {lines.map((line) => (
            <p key={line.key}>{lineText(i18n, line)}</p>
          ))}
        </div>
        <SpeakButton lang={i18n.lang} text={spoken(i18n, lines)} />
      </div>
      {sources && <Sources sources={sources} />}
      {children}
    </div>
  );
}
