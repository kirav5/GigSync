import {
  type BoardQueryInput,
  type BoardWorker,
  type City,
  type EstimateSource,
  type Lang,
  MAX_RESULTS,
  type RateCard,
  type Trade,
  type UserId,
} from "@gigsync/protocol";
import { pluralKey } from "../i18n/t.js";
import type { Line } from "../interview/card.js";
import { rateHint, rateNote } from "../interview/card-rates.js";
import { estimateLines, type FoundEstimate } from "../interview/estimate-lines.js";
import { CITY_RATES } from "../job/city-rates.js";
import { CITY_AREA } from "../landing/cities.js";
import { log } from "../log.js";

/**
 * The work outlook for someone moving to a city, for each of their trades: the usual range there from the estimate
 * (with how many sources and the legal minimum), else the static band the app ships for that city, else that there is
 * no figure; how many workers of that trade have a card on the board there, when known; and one line saying the
 * figures are estimates. Every number is the estimate's, the band's, the law's or the board's: built here by code,
 * never by a model.
 */

/** What the outlook is built from: the move's city (none when it has no guide), the trades, and what was found. */
export interface OutlookInput {
  city?: City | undefined;
  trades: readonly Trade[];
  own: Lang;
  /** The estimate found for each trade, at its default scope; a trade missing here has none (or none yet). */
  estimates: Readonly<Partial<Record<Trade, FoundEstimate>>>;
  /** Workers of each trade on the board in the city, when the board was asked; a trade missing here is not counted. */
  listed: Readonly<Partial<Record<Trade, number>>>;
  /** The static band; the shipped card unless a test passes another. */
  rates?: RateCard;
}

export interface Outlook {
  lines: Line[];
  /** The pages the estimates rest on, to fold under the lines. */
  sources: EstimateSource[];
}

/** The card's city is the move's: another city's band is never shown as this one's. */
const cardFor = (rates: RateCard, city: City | undefined): RateCard | undefined =>
  city !== undefined && rates.city.toLowerCase() === city ? rates : undefined;

/** One trade's figures: the estimate's lines, else the band's, else that there are none there. */
function tradeLines(i: OutlookInput, trade: Trade, card: RateCard | undefined): { lines: Line[]; band: boolean } {
  const found = i.estimates[trade];
  if (found) return { lines: estimateLines(i.own, found), band: false };
  if (card) return { lines: rateHint(card, trade), band: true };
  return { lines: [{ key: "moving.no_figures", names: { trade: [`trade.${trade}`] } }], band: false };
}

/** How many workers of the trade the board has in the city; "or more" when the board's page was full. */
function listedLine(i: OutlookInput, trade: Trade): Line[] {
  const count = i.listed[trade];
  if (count === undefined || i.city === undefined) return [];
  const names = { trade: [`trade.${trade}` as const], city: [`city.${i.city}` as const] };
  if (count >= MAX_RESULTS) return [{ key: "moving.listed_many", names, params: { count } }];
  return [{ key: pluralKey(i.own, "moving.listed", count), names, params: { count } }];
}

/** The outlook's lines in order, trade by trade, then the notes; "no figures" alone when there is no city. */
export function workOutlook(i: OutlookInput): Outlook {
  if (i.city === undefined) return { lines: [{ key: "moving.no_outlook" }], sources: [] };
  const card = cardFor(i.rates ?? CITY_RATES, i.city);
  const each = i.trades.map((trade) => ({ trade, ...tradeLines(i, trade, card) }));
  const banded = each.filter((e) => e.band).map((e) => e.trade);
  const lines = [
    ...each.flatMap((e) => [...e.lines, ...listedLine(i, e.trade)]),
    ...(card ? rateNote(card, banded) : []),
    { key: "moving.estimates" } satisfies Line,
  ];
  const sources = i.trades.flatMap((trade) => i.estimates[trade]?.estimate.basis.sources ?? []);
  return { lines, sources };
}

/** The board's search, as `ApiClient.searchWorkers` does it. */
export type SearchBoard = (query: BoardQueryInput) => Promise<BoardWorker[]>;

/**
 * Workers of a trade with a card on the board in the city with a guide, not counting the owner: one search across the
 * city's area, at most a page of `MAX_RESULTS`. Undefined when the board cannot be reached; the outlook goes without it.
 */
export async function countListed(
  search: SearchBoard,
  city: City,
  trade: Trade,
  me: UserId,
): Promise<number | undefined> {
  const { centre, radius_km } = CITY_AREA[city];
  try {
    const found = await search({ trade, lat: centre.lat, lon: centre.lon, radius_km, limit: MAX_RESULTS });
    // A full page may hold the owner too: it still says "or more".
    return found.length >= MAX_RESULTS ? MAX_RESULTS : found.filter((w) => w.user !== me).length;
  } catch (err) {
    log.warn("board count failed", { trade, error: err instanceof Error ? err.name : String(err) });
    return undefined;
  }
}
