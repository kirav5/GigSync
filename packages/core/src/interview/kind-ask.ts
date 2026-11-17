import { Trade, type WorkCategory } from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import type { NeedDraft } from "./need-types.js";

/**
 * The first question for each kind of work, as data (ADR 0065 §3): "What's wrong with the TV: no picture, no sound, or
 * it won't turn on?" where the fixed question says "What exactly is the work?". It asks what the work's fixed first
 * question asks, so the answer fills the same detail and the estimate reads it as before. Every phone asks it, with or
 * without a model, typed or tapped; no model words it any more (it did after a tap, ADR 0061).
 */

const T = Trade.enum;

/** Trades whose fixed first question is only "what isn't working": theirs names what usually breaks. */
const TRADE_ASK: Readonly<Partial<Record<Trade, MessageKey>>> = {
  [T.electrician]: "kind_ask.electrician",
  [T.plumber]: "kind_ask.plumber",
  [T.carpenter]: "kind_ask.carpenter",
  [T.ac_technician]: "kind_ask.ac_technician",
};

const categoryAsk = (category: WorkCategory): MessageKey => `kind_ask.${category}`;

/** The work's own first question, when it has one; else the fixed question for its trade or for other work is asked. */
export function kindAsk(d: Pick<NeedDraft, "trade" | "skill">): MessageKey | undefined {
  if (d.trade) return TRADE_ASK[d.trade];
  return d.skill?.category ? categoryAsk(d.skill.category) : undefined;
}
