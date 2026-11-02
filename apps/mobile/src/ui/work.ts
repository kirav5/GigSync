import type { BoardProfile, JobRequest } from "@gigsync/protocol";
import type { I18n } from "../i18n.js";

/**
 * The work, as a person reads it (ADR 0047): trades in the reader's language, a worker's own skills in their own
 * words, as they wrote them.
 */

/** What a card lists: its trades, then its skills, joined. */
export const cardWork = (t: I18n["t"], card: Pick<BoardProfile, "trades" | "skills">): string =>
  [...card.trades.map((tr) => t(`trade.${tr}`)), ...(card.skills ?? []).map((s) => s.text)].join(", ");

/** What a request is for: the listed skill asked for, else the trade's name. */
export const requestWork = (t: I18n["t"], request: Pick<JobRequest, "trade" | "skill">): string =>
  request.skill?.text ?? t(`trade.${request.trade}`);
