import {
  addressLine,
  areaKeyOfAddress,
  DayWord,
  doorOf,
  draftDetails,
  EVERY_DAY,
  type GigDevice,
  type JobRecord,
  type NeedParts,
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
  requestPoint,
  resolveDay,
  windowOf,
  workOf,
} from "@gigsync/core";
import {
  type Arrangement,
  type BoardProfile,
  type BoardWorker,
  coarsePoint,
  isTrade,
  type Place,
  type SavedAddress,
  skillKey,
  type UserId,
} from "@gigsync/protocol";
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
  skills: (card.skills ?? []).map((s) => ({ ...s, key: skillKey(s.text), workers: 1 })),
});

/** The worker of a job that ended without one, asked again in a new chat for the same work (ADR 0053 §5). */
export const needToOfJob = (job: JobRecord, name: string): NeedTo => ({
  user: job.engagement.counterpart,
  name,
  trades: isTrade(job.request.trade) ? [job.request.trade] : [],
  skills: job.request.skill ? [{ ...job.request.skill, key: skillKey(job.request.skill.text), workers: 1 }] : [],
});

/**
 * The board's workers for a trade, or a listed skill by its key (ADR 0047: never the owner's words), near a place;
 * never the owner's own card (a worker hiring never hires themself). With the need's day and the part of the day its
 * hour falls in, only workers who work then and have no signed job then (ADR 0050 §3).
 */
export async function searchBoard(
  account: Account,
  work: Pick<NeedState["draft"], "trade" | "skill" | "day" | "time">,
  at: Place,
  radius_km: number,
  arrangement?: Arrangement,
  now = new Date(),
): Promise<BoardWorker[]> {
  const near = coarsePoint(at);
  const what = work.skill ? { skill: work.skill.key } : { trade: work.trade };
  const day = work.day && resolveDay(work.day, now, -now.getTimezoneOffset());
  const window = windowOf(work.time);
  const when = { ...(day ? { day } : {}), ...(window ? { window } : {}) };
  const query = { ...what, lat: near.lat, lon: near.lon, radius_km, ...(arrangement ? { arrangement } : {}), ...when };
  const board = await apiClient(account.session).searchWorkers(query);
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
export function needOf(
  state: NeedState,
  i18n: Pick<I18n, "t" | "date">,
  now: Date,
  saved: readonly SavedAddress[] = [],
): NewNeed | undefined {
  const d = state.draft;
  const at = whereOf(d, saved);
  const trade = workOf(d);
  if (!trade || !at || d.budget_paise === undefined) return undefined;
  const day = resolveDay(d.day ?? DayWord.today, now, -now.getTimezoneOffset());
  const found = needEstimate(state);
  return needToSend({
    trade,
    ...(d.skill ? { skill: { text: d.skill.text, lang: d.skill.lang } } : {}),
    need: needWords(d, state.config.own),
    day,
    label: dayLabel(i18n, day),
    time: d.time,
    details: draftDetails(d),
    budget_paise: d.budget_paise,
    ...at,
    estimate: found && perJob(found.estimate, needDetails(d)),
    terms: needTerms(d, trade, day),
  });
}

/** Where a need is: its saved address (coarse point, locality, the line for after signing), else its pilot area. */
export function whereOf(
  d: NeedState["draft"],
  saved: readonly SavedAddress[],
): Pick<NeedParts, "area" | "locality" | "site" | "door"> | undefined {
  // The one picked; else, for an area said in words, the household's only saved address in it; else their only one.
  const inArea = saved.filter((a) => areaKeyOfAddress(a) === d.area);
  const only = inArea.length === 1 ? inArea[0] : saved.length === 1 && !d.area ? saved[0] : undefined;
  const address = d.address ? saved.find((a) => a.id === d.address) : only;
  const point = address && requestPoint(address);
  const pin = doorOf(address);
  const door = pin ? { door: pin } : {};
  if (address && point) return { area: point, locality: address.area, site: addressLine(address), ...door };
  const pilot = AREAS.find((a) => a.key === d.area);
  // A saved address with no point and no pilot area near it: searched from its area's name when GigSync has one.
  if (address && pilot) return { area: pilot, locality: address.area, site: addressLine(address), ...door };
  return pilot && { area: pilot };
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
