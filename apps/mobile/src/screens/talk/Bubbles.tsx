import type { Line } from "@gigsync/core";
import type { ReactNode } from "react";
import { type I18n, useI18n } from "../../i18n.js";
import { money } from "../../ui/places.js";
import { SpeakButton } from "../../ui/SpeakButton.js";
import { Cursor, useTyped } from "../../ui/Typed.js";
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

/** Between the lines of a question, as one text to write out. */
const LINE_BREAK = "\n";

/**
 * A question or readback, with its replay button; the silent lines are shown but never spoken. With `split`, the
 * bubble holds only the lines before it: the rest are drawn by `children` (the price question's estimate card), and
 * are still read aloud with the question. The newest question (`typing`) writes itself out letter by letter with a
 * blinking cursor, as the AI apps do, and what goes with it (chips, a card) comes once it is written.
 */
export function Ask({
  lines,
  split,
  typing = false,
  children,
}: {
  lines: readonly Line[];
  split?: number | undefined;
  typing?: boolean;
  children?: ReactNode;
}) {
  const i18n = useI18n();
  const shown = split === undefined ? lines : lines.slice(0, split);
  const texts = shown.map((line) => lineText(i18n, line));
  const all = texts.join(LINE_BREAK);
  const { shown: count, writing } = useTyped(all, typing);
  const stillWriting = count < all.length;
  // Where each line starts in the whole text, to cut it at the letters written so far.
  const starts = texts.map((_, i) => texts.slice(0, i).reduce((n, text) => n + text.length + LINE_BREAK.length, 0));
  return (
    <div className="msg-agent iv-ask">
      <div className="iv-say">
        <div className="text">
          {shown.map((line, i) => {
            const text = texts[i] ?? "";
            const start = starts[i] ?? 0;
            if (stillWriting && count <= start && i > 0) return null;
            const cut = text.slice(0, Math.max(0, count - start));
            return (
              <p key={line.key} className={line.aside ? "iv-aside" : undefined}>
                {cut}
                {writing && count - start <= text.length && <Cursor />}
              </p>
            );
          })}
        </div>
        <SpeakButton lang={i18n.lang} text={spoken(i18n, lines)} />
      </div>
      {!stillWriting && children}
    </div>
  );
}
