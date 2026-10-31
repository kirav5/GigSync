import { readFileSync } from "node:fs";
import {
  type Agree,
  CityGuide,
  type EngagementId,
  type OfferId,
  type Place,
  type Role,
  type UserId,
} from "@gigsync/protocol";
import type { JobRecord } from "../src/index.js";

/** The Bengaluru guide as the API serves it: the draft checked into workers/api, parsed with its schema. */
export const BENGALURU: CityGuide = CityGuide.parse(
  JSON.parse(readFileSync(new URL("../../../workers/api/content/bengaluru.json", import.meta.url), "utf8")),
);

export const OWNER = "usr_01J0000000000000000000WWWW" as UserId;
const CUSTOMER = "usr_01J0000000000000000000CCCC" as UserId;
/** Koramangala, inside Bengaluru; Mysuru, 140 km away. */
export const KORAMANGALA: Place = { lat: 12.9352, lon: 77.6245 };
export const MYSURU: Place = { lat: 12.2958, lon: 76.6394 };

let seq = 0;
const nextId = () => String(++seq).padStart(26, "0");

/** A job on this phone at `area`, signed by this side and (unless `theirs` is false) by the other. */
export function signedJob(area: Place, opts: { role?: Role; theirs?: boolean } = {}): JobRecord {
  const id = `eng_${nextId()}` as EngagementId;
  const at = "2026-11-10T09:00:00+05:30";
  const agree: Agree = {
    terms: {
      engagement: id,
      offer_id: `off_${nextId()}` as OfferId,
      worker: OWNER,
      consumer: CUSTOMER,
      trade: "maid",
      scope: "Cleaning",
      slot: "tomorrow 10:00",
      price_paise: 50_000,
    },
    terms_hash: "a".repeat(64),
    sig: "c2lnbmVk",
  };
  return {
    engagement: {
      id,
      group: id,
      role: opts.role ?? "provider",
      counterpart: CUSTOMER,
      status: "agreed",
      brief: { text: "Cleaning", topic: "maid", shared: {} },
      created_at: at,
      updated_at: at,
    },
    request: { trade: "maid", need: "Cleaning", when: "tomorrow", area, details: {}, lang: "en" },
    offers: [],
    offers_made: 1,
    asked: false,
    mine: agree,
    ...(opts.theirs === false ? {} : { theirs: agree }),
  };
}
