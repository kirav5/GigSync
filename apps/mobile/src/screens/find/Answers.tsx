import { ADD_ADDRESS, NeedSlot, type NeedState } from "@gigsync/core";
import { Adding } from "./AddAddress.js";
import { AddressOptions, type WhereTools } from "./AddressOptions.js";
import { BudgetCard } from "./BudgetCard.js";
import { Choices, type ChoicesProps } from "./Choices.js";
import { ReadbackActions } from "./ReadbackActions.js";

export interface AnswerTools {
  where: WhereTools;
  /** Words the owner chose from the screen, sent as if typed (an amount at the budget question). */
  onSay: (text: string) => void;
}

/**
 * The answers under the newest question, drawn for what it asks: the saved doors as cards at "where" (a household's),
 * the usual range at the budget, the readback's Yes and Change something; chips for everything else.
 */
export function Answers({
  state,
  where,
  onSay,
  ...props
}: Omit<ChoicesProps, "onAddAddress"> & AnswerTools & { state: NeedState }) {
  const chips = { ...props, onAddAddress: () => where.onAdd(Adding.typed) };
  // "Ask about other work instead?" can come at any question: its yes and no are plain chips.
  if (state.switching) return <Choices {...chips} />;
  switch (state.slot) {
    case NeedSlot.area:
      // A household's "where", which always offers to add an address; an offer from memory has its own chips.
      return props.choices.some((c) => c.value === ADD_ADDRESS) ? (
        <AddressOptions {...props} where={where} inUse={state.config.inUse} />
      ) : (
        <Choices {...chips} />
      );
    case NeedSlot.budget:
      return <BudgetCard {...chips} state={state} onSay={onSay} />;
    case NeedSlot.confirm:
      return state.changing ? (
        <Choices {...chips} />
      ) : (
        <ReadbackActions {...chips} addressed={state.to !== undefined} />
      );
    default:
      return <Choices {...chips} />;
  }
}
