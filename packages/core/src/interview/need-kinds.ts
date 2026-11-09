import { GROUP_KINDS, groupOf, WorkGroup } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { GROUP_PICK, kindKey, kindValue } from "../skills/kinds.js";
import type { Choice, Line, Prompt } from "./card.js";
import type { NeedState } from "./need.js";
import { NeedPick } from "./need-hear.js";

/**
 * Picking the work from a list in Find (ADR 0061): the groups first, then every kind of work in the one picked, trades
 * and the kinds outside them alike. And when a kind nobody lists yet was asked for, the others in its group that have
 * workers, so the chat does not end there: laundry and ironing has nobody, a maid might do it.
 */

const groupValue = (g: WorkGroup) => `${GROUP_PICK}${g}`;

export function kindsPrompt(s: NeedState): Prompt {
  const own = s.config.own;
  if (!s.browsing) {
    const groups = WorkGroup.options;
    return {
      lines: [{ key: "need.pick_group" }],
      choices: groups.map((g) => ({ value: groupValue(g), key: `group.${g}` as const })),
      hints: groups.map((g) => t(own, `group.${g}`)),
    };
  }
  const kinds = GROUP_KINDS[s.browsing];
  return {
    lines: [{ key: "need.ask.trade" }],
    choices: [
      ...kinds.map((k) => ({ value: kindValue(k), key: kindKey(k) })),
      { value: NeedPick.groups, key: "need.all_groups" },
    ],
    hints: kinds.map((k) => t(own, kindKey(k))),
  };
}

/** A tap on a group, or back to the groups; undefined for any other tap. */
export function chooseKindPick(s: NeedState, value: string): NeedState | undefined {
  if (value === NeedPick.groups) return { ...s, browsing: undefined, notes: [] };
  if (!value.startsWith(GROUP_PICK)) return undefined;
  const group = WorkGroup.safeParse(value.slice(GROUP_PICK.length)).data;
  return group ? { ...s, browsing: group, fresh: false, notes: [] } : s;
}

/** The others in an empty kind's group that have workers, as a line and chips; none when there are none. */
export function othersOf(s: NeedState): { lines: Line[]; choices: Choice[] } {
  const { emptyKind, others } = s.draft;
  if (!emptyKind || !others?.length) return { lines: [], choices: [] };
  const group = t(s.config.own, `group.${groupOf(emptyKind)}`);
  return {
    lines: [{ key: "need.group_others", params: { group } }],
    choices: others.map((k) => ({ value: kindValue(k), key: kindKey(k) })),
  };
}
