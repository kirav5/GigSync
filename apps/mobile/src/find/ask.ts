import {
  DayWord,
  draftDetails,
  EVERY_DAY,
  type GigDevice,
  type NeedState,
  type NeedTo,
  type NewNeed,
  needDetails,
  needEstimate,
  needTerms,
  needToSend,
  needWords,
  type Ports,
  perJob,
  resolveDay,
} from "@gigsync/core";
import type { BoardProfile, BoardWorker, Place, Trade, UserId } from "@gigsync/protocol";
import { type Account, apiClient, rememberName } from "../adapters/account.js";
import type { I18n } from "../i18n.js";
import { dayDate } from "../screens/jobGroups.js";
import { AREAS } from "../ui/places.js";

/**
 * Find's calls: search the board near an area, and ask the workers the household picked, or the one worker a chat is
 * addressed to. The request itself is built in core (`needToSend`).
 */

/** A worker the household chose before Find opened (from their QR, or an offer to work): asked alone, in a new chat. */
export interface ChosenWorker {
  user: UserId;
  card: BoardProfile;
}

/** Who a worker asked from Find is: their id, and the name kept on this phone for My jobs. */
type Asked = Pick<BoardWorker, "user" | "display_name">;

/** A chosen worker as the chat addressed to them names them. */
export const needToOf = ({ user, card }: ChosenWorker): NeedTo => ({
  user,
  name: card.display_name,
  trades: card.trades,
});

/** The board's workers for a trade near a place, never the owner's own card (a worker hiring never hires themself). */
export async function searchBoard(
  account: Account,
  trade: Trade,
  at: Place,
  radius_km: number,
): Promise<BoardWorker[]> {
  const board = await apiClient(account.session).searchWorkers({ trade, lat: at.lat, lon: at.lon, radius_km });
  return board.filter((w) => w.user !== account.session.user);
}

/**
 * The day as the request's `when` names it: the date itself, never "Today" or "Tomorrow", which are true only on the
 * day they are sent ("कल" is also yesterday); or "Every day".
 */
export const dayLabel = ({ t, date }: Pick<I18n, "t" | "date">, day: string): string =>
  day === EVERY_DAY ? t("when.daily") : date(dayDate(day));

/**
 * The request a finished need sends, its day resolved on the phone's calendar `now`; undefined while something it
 * needs is missing. The estimate the household saw beside the budget goes with it, for notes on far-off offers.
 */
export function needOf(state: NeedState, i18n: Pick<I18n, "t" | "date">, now: Date): NewNeed | undefined {
  const d = state.draft;
  const area = AREAS.find((a) => a.key === d.area);
  if (!d.trade || !area || d.budget_paise === undefined) return undefined;
  const day = resolveDay(d.day ?? DayWord.today, now, -now.getTimezoneOffset());
  const found = needEstimate(state);
  return needToSend({
    trade: d.trade,
    need: needWords(d, state.config.own),
    day,
    label: dayLabel(i18n, day),
    time: d.time,
    details: draftDetails(d),
    budget_paise: d.budget_paise,
    area,
    estimate: found && perJob(found.estimate, needDetails(d)),
    terms: needTerms(d, d.trade, day),
  });
}

/** Sends one need to the workers asked, keeping their names on this phone for My jobs. */
export async function askWorkers(
  ports: Ports,
  device: GigDevice,
  need: NewNeed,
  asked: readonly Asked[],
): Promise<void> {
  await Promise.all(asked.map((w) => rememberName(ports, w.user, w.display_name)));
  await device.request(
    need,
    asked.map((w) => w.user),
  );
}

/** The worker a need is addressed to, as asked. */
export const askedTo = (to: NeedTo): Asked => ({ user: to.user, display_name: to.name });
