import type { Estimate } from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import type { Line } from "./card.js";

/** What an ADR 0041 estimate says to its owner under its range: what its spread mostly depends on. */

const noun = (name: string): MessageKey => `driver.noun.${name}` as MessageKey;

/** What drives the range's spread, in plain words: the one thing an owner can tell to narrow it. */
export const driverLines = (estimate: Estimate): Line[] =>
  estimate.spread_by ? [{ key: "driver.spread", names: { driver: [noun(estimate.spread_by)] } }] : [];

/** A need outside the trades: plainly, no prices yet and no listed worker, and how to go on. */
export const jobTypeLines = (jobType: string): Line[] => [{ key: "driver.no_trade", params: { job: jobType } }];
