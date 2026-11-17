import {
  AcProblem,
  CarpenterProblem,
  City,
  ElectricianProblem,
  Finish,
  HouseType,
  MaidFrequency,
  MaidTasks,
  MaterialsBy,
  type PlaceKey,
  PlumberProblem,
  PriceUnit,
  type RateCardSource,
  Surface,
  Trade,
  Vehicle,
} from "@gigsync/protocol";
import { CITY_RATES } from "../job/city-rates.js";

/**
 * The community rate cards of ADR 0041 §3 (as the founders set it on 2026-10-31: no cloud model in estimates): a
 * city's per-unit rates for each trade's base job (the drivers' defaults), each entry with where its figures come
 * from. One of two sources, beside GigSync's agreed jobs. Cook and maid come from the city pack's card
 * (`city-rates.ts`) and keep its sources; every other figure is a GigSync seed, unverified, until a union, a
 * government notification or GigSync's own jobs replace it. Never a figure without a source, and never an invented
 * source: an unknown URL says "to be confirmed".
 */

/** Low, typical and high in paise. */
export interface PaiseRange {
  low: number;
  typical: number;
  high: number;
}

/** One trade's entry on a card: what it is per, its figures, and where they come from. */
export interface RateCardEntry {
  unit: PriceUnit;
  range: PaiseRange;
  sources: readonly RateCardSource[];
}

/** A city's card: its name and an entry per trade. */
export interface RateCardSet {
  name: string;
  entries: Readonly<Record<Trade, RateCardEntry>>;
}

const RUPEE = 100;
const rupees = (low: number, typical: number, high: number): PaiseRange => ({
  low: low * RUPEE,
  typical: typical * RUPEE,
  high: high * RUPEE,
});

const T = Trade.enum;
const U = PriceUnit.enum;
const TO_BE_CONFIRMED = "to be confirmed";

/** Figures nobody outside GigSync has checked yet. */
export const GIGSYNC_SEED: RateCardSource = {
  name: "GigSync seed, unverified",
  issuer: "GigSync",
  date: "2026-10-31",
  url: TO_BE_CONFIRMED,
};
/** The city pack's cook band (`city-rates.ts`), as its comments state its sources. */
const COOK_SOURCE: RateCardSource = {
  name: "Cookzy Bengaluru FAQ; Solve24 cook prices",
  issuer: "Cookzy; Solve24 (service listings)",
  date: "2026, read 2026-10-28",
  url: "solve24.in",
};
/** The city pack's maid band, as its comments state its sources. */
const MAID_SOURCE: RateCardSource = {
  name: "Knoqq; EzyHelpers; MyBuddyMaid maid prices",
  issuer: "Knoqq; EzyHelpers; MyBuddyMaid (service listings)",
  date: "2026-04 to 2026-09",
  url: "knoqq.com",
};
/** The statutory floor `LEGAL_MINIMUM` applies (`city-rates.ts`). */
export const KARNATAKA_MINIMUM: RateCardSource = {
  name: "Karnataka minimum wages 2026",
  issuer: "Government of Karnataka, Labour Department (KAE 68 LWA 2022, with VDA)",
  date: "2026-04-01",
  url: "karmikaspandana.karnataka.gov.in",
};

const band = (trade: Trade) => CITY_RATES.bands.find((b) => b.trade === trade);
/** A card band's middle, as its typical figure. */
const fromCard = (trade: Trade, share = 1): PaiseRange => {
  const b = band(trade);
  const low = (b?.low_paise ?? 0) * share;
  const high = (b?.high_paise ?? 0) * share;
  return { low, typical: (low + high) / 2, high };
};

/** Meals the card's cook band is for (two meals, up to three people): the base is one meal. */
const CARD_COOK_MEALS = 2;
/** Hours a day the seed driver wage is for. */
const DRIVER_BASE_HOURS = 8;
const seed = (unit: PriceUnit, range: PaiseRange): RateCardEntry => ({ unit, range, sources: [GIGSYNC_SEED] });

/**
 * Bengaluru. Painter: per sq ft of floor area, inside walls, painter brings the paint, plain finish, a flat: ₹40–₹65
 * (typical ₹50), a seed (a 1,000 sq ft 2BHK repainted inside with paint at ₹40,000–₹65,000). Cook: per month for one
 * meal a day, six days a week, up to three people: half the card's two-meal band. Maid: per month, daily, 2 rooms,
 * sweeping, mopping and dishes: the card's band. Driver: per month for one hour a day, six days a week, from a seed of
 * ₹18,000–₹26,000 a month for eight hours. Repairs: per visit for one point of "other" work, seeds.
 */
export const RATE_CARDS: Readonly<Partial<Record<PlaceKey, RateCardSet>>> = {
  [City.enum.bengaluru]: {
    name: "Bengaluru rate card",
    entries: {
      [T.painter]: seed(U.sqft, rupees(40, 50, 65)),
      [T.cook]: { unit: U.month, range: fromCard(T.cook, 1 / CARD_COOK_MEALS), sources: [COOK_SOURCE] },
      [T.maid]: { unit: U.month, range: fromCard(T.maid), sources: [MAID_SOURCE] },
      [T.driver]: seed(
        U.month,
        rupees(18_000 / DRIVER_BASE_HOURS, 22_000 / DRIVER_BASE_HOURS, 26_000 / DRIVER_BASE_HOURS),
      ),
      [T.electrician]: seed(U.visit, rupees(300, 450, 700)),
      [T.plumber]: seed(U.visit, rupees(300, 450, 700)),
      [T.carpenter]: seed(U.visit, rupees(400, 600, 1000)),
      [T.ac_technician]: seed(U.visit, rupees(500, 700, 1000)),
    },
  },
};

/** A city's card entry for a trade, when the city has a card. */
export const rateCardEntry = (city: PlaceKey, trade: Trade): RateCardEntry | undefined =>
  RATE_CARDS[city]?.entries[trade];

/** What an estimate is given in, per trade: painting as the whole job once its area is known, household work a month. */
export const ESTIMATE_UNIT: Readonly<Record<Trade, PriceUnit>> = {
  [T.painter]: U.job,
  [T.cook]: U.month,
  [T.maid]: U.month,
  [T.driver]: U.month,
  [T.electrician]: U.job,
  [T.plumber]: U.job,
  [T.carpenter]: U.job,
  [T.ac_technician]: U.job,
};

/** Adjustments below: GigSync seeds, unverified, unless a line names a source. ASSUMED: outside walls of a home are about 0.8 of the inside job for the same floor area (less area, dearer paint). */
export const SURFACE_FACTOR: Readonly<Record<Surface, { inside: number; outside: number }>> = {
  [Surface.enum.inside]: { inside: 1, outside: 0 },
  [Surface.enum.outside]: { inside: 0, outside: 0.8 },
  [Surface.enum.both]: { inside: 1, outside: 0.8 },
};
/** ASSUMED: each floor above the ground adds a tenth to outside work (scaffolding, ropes, slower work). */
export const OUTSIDE_PER_FLOOR = 0.1;
/** ASSUMED: villas have higher ceilings and more detail; independent houses a little more than flats. */
export const HOUSE_FACTOR: Readonly<Record<HouseType, number>> = {
  [HouseType.enum.flat]: 1,
  [HouseType.enum.independent]: 1.05,
  [HouseType.enum.villa]: 1.15,
};
/** ASSUMED floor area per bedroom (sq ft), to estimate the area when the household does not know it. */
export const SQFT_PER_ROOM: Readonly<Record<HouseType, number>> = {
  [HouseType.enum.flat]: 500,
  [HouseType.enum.independent]: 600,
  [HouseType.enum.villa]: 750,
};
/** ASSUMED: an area estimated from bedrooms is within a fifth either way. */
export const AREA_FROM_ROOMS_SPREAD = 0.2;
/** ASSUMED: labour is about 40% of a painting job with paint; the household buying the paint pays that share. */
export const PAINT_BY_FACTOR: Readonly<Record<MaterialsBy, number>> = {
  [MaterialsBy.enum.worker]: 1,
  [MaterialsBy.enum.household]: 0.4,
};
/** ASSUMED: a texture finish costs half as much again as plain emulsion. */
export const FINISH_FACTOR: Readonly<Record<Finish, number>> = { [Finish.enum.plain]: 1, [Finish.enum.texture]: 1.5 };

/** From the card: each person past three adds about 8% to a cook's pay; ASSUMED the same off for fewer. */
export const COOK_PER_PERSON = 0.08;
export const COOK_BASE_PEOPLE = 3;
/** The usual week (26 working days a month, as the legal minimum counts). */
export const BASE_DAYS_WEEK = 6;
/** From the card: each room past two adds about 15% to a maid's pay; ASSUMED the same off for one room. */
export const MAID_PER_ROOM = 0.15;
export const MAID_BASE_ROOMS = 2;
/** ASSUMED: alternate-day visits do a little more each time; weekly ones are a deep clean. */
export const MAID_FREQUENCY_FACTOR: Readonly<Record<MaidFrequency, number>> = {
  [MaidFrequency.enum.daily]: 1,
  [MaidFrequency.enum.alternate_days]: 0.55,
  [MaidFrequency.enum.weekly]: 0.25,
};
/** ASSUMED shares of the base work (sweeping, mopping and dishes). */
export const MAID_TASKS_FACTOR: Readonly<Record<MaidTasks, number>> = {
  [MaidTasks.enum.sweep_mop]: 0.75,
  [MaidTasks.enum.sweep_mop_dishes]: 1,
  [MaidTasks.enum.full]: 1.5,
};
/** ASSUMED: a bigger car pays a little more. */
export const VEHICLE_FACTOR: Readonly<Record<Vehicle, number>> = {
  [Vehicle.enum.hatchback]: 1,
  [Vehicle.enum.sedan]: 1.05,
  [Vehicle.enum.suv]: 1.1,
};
/** ASSUMED: each point past the first costs 0.6 of the first (the visit charge is paid once). */
export const EXTRA_POINT = 0.6;
/** ASSUMED: each problem's cost against the trade's "other" visit. */
export const PROBLEM_FACTOR: Readonly<Partial<Record<Trade, Readonly<Record<string, number>>>>> = {
  [T.electrician]: {
    [ElectricianProblem.enum.fan]: 1,
    [ElectricianProblem.enum.switch]: 0.6,
    [ElectricianProblem.enum.light]: 0.7,
    [ElectricianProblem.enum.wiring]: 4,
    [ElectricianProblem.enum.other]: 1,
  },
  [T.plumber]: {
    [PlumberProblem.enum.leak]: 1.2,
    [PlumberProblem.enum.tap]: 0.8,
    [PlumberProblem.enum.blockage]: 1.4,
    [PlumberProblem.enum.toilet]: 1.8,
    [PlumberProblem.enum.other]: 1,
  },
  [T.carpenter]: {
    [CarpenterProblem.enum.door]: 1.2,
    [CarpenterProblem.enum.repair]: 1,
    [CarpenterProblem.enum.assembly]: 1.3,
    [CarpenterProblem.enum.other]: 1,
  },
  [T.ac_technician]: {
    [AcProblem.enum.service]: 0.9,
    [AcProblem.enum.gas_refill]: 4,
    [AcProblem.enum.install]: 2.5,
    [AcProblem.enum.repair]: 1.4,
    [AcProblem.enum.other]: 1,
  },
};
