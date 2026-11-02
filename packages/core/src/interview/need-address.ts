import { t } from "../i18n/t.js";
import type { Choice, Line, Prompt } from "./card.js";
import { areaChoices, areaHints, isMessageKey } from "./choices.js";
import { moveOn, type NeedState } from "./need.js";
import type { AddressChoice, NeedDraft } from "./need-types.js";

/**
 * Find's "where" question (ADR 0045): the household's saved addresses first, then "Add an address" (the app opens the
 * form and comes back with the new one), then the pilot areas for a need asked by area alone. A saved address sets the
 * area the search and the estimate use, and the address the worker gets once both have signed.
 */

/** The chip that opens the address form: the app handles it; the interview stays where it is. */
export const ADD_ADDRESS = "add_address";

const addressChip = (s: NeedState, a: AddressChoice): Choice => ({
  value: a.id,
  key: "addr.chip",
  params: { label: t(s.config.own, `addr.label.${a.label}`), area: a.areaName },
});

/** The "where" question: saved addresses for a household, the pilot areas for everyone. */
export function wherePrompt(s: NeedState): Prompt {
  const own = s.config.own;
  const areas = { choices: areaChoices(s.config.areas), hints: areaHints(s.config.areas, own) };
  const saved = s.config.addresses;
  if (!saved) return { lines: [{ key: "need.ask.area" }], ...areas };
  const chips = [...saved.map((a) => addressChip(s, a)), { value: ADD_ADDRESS, key: "addr.add" } as const];
  return { lines: [{ key: "need.ask.address" }], choices: [...chips, ...areas.choices], hints: areas.hints };
}

/** The draft at a saved address. */
export const atAddress = (d: NeedDraft, a: AddressChoice): NeedDraft => ({
  ...d,
  area: a.area,
  areaName: a.areaName,
  address: a.id,
});

/** A tapped saved address; undefined for any other value. */
export function chooseAddress(s: NeedState, value: string): NeedState | undefined {
  const a = s.config.addresses?.find((x) => x.id === value);
  return a ? moveOn(s, atAddress(s.draft, a)) : undefined;
}

/** A pilot area tapped or said: the need is asked by area alone, at no saved address. */
export const atArea = (d: NeedDraft, area: string): NeedDraft => ({
  ...d,
  area,
  areaName: undefined,
  address: undefined,
});

/** The area as a line shows it: a pilot area in the reader's language, any other locality by its name. */
export function areaParts(d: NeedDraft): Pick<Line, "names" | "params"> {
  const key = `area.${d.area ?? ""}`;
  if (isMessageKey(key)) return { names: { area: [key] } };
  return { params: { area: d.areaName ?? d.area ?? "" } };
}
