import { type LiveCities, parseLiveCities } from "@gigsync/core";
import { NO_CITY, type PlaceKey } from "@gigsync/protocol";
import { DEFAULT_CITY } from "./db/job-records.js";
import type { Env } from "./env.js";

/** The `LIVE_CITIES` setting (README "Live cities"): the directory's cities kept, or every place. */
export const liveCitiesOf = (env: Env): LiveCities => parseLiveCities(env.LIVE_CITIES);

/**
 * The city a job record takes when the worker's card is in no live city: Bengaluru, as every record before ADR 0061
 * was; with every place let in, none, so a test job in Sitapur never feeds Bengaluru's prices.
 */
export const recordFallbackCity = (env: Env): PlaceKey => (liveCitiesOf(env).anywhere ? NO_CITY : DEFAULT_CITY);
