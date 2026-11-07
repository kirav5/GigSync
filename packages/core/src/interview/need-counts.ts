import { FindEvent, Trade } from "@gigsync/protocol";
import { NeedSlot, type NeedState } from "./need.js";
import { NeedPick } from "./need-hear.js";

/**
 * What a tap in Find counts as (ADR 0060): a trade picked from the list, "Not this", or the work changed at the readback,
 * which shows how often the work was read wrong and only caught at the end.
 */
export function findEventOf(s: NeedState, value: string): FindEvent | undefined {
  if (value === NeedPick.notThis) return FindEvent.enum.not_this;
  if (s.slot === NeedSlot.trade && Trade.options.some((tr) => tr === value)) return FindEvent.enum.tapped;
  return s.slot === NeedSlot.confirm && s.changing && value === NeedSlot.trade ? FindEvent.enum.changed : undefined;
}
