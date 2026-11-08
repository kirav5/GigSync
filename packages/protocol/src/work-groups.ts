import { z } from "zod";
import { Trade } from "./trade.js";
import { WorkCategory } from "./work-category.js";

/**
 * Groups of kinds of work (ADR 0061), for finding them, never for pricing them: a babysitter and a pet carer sit in one
 * group and each keeps its own price. The 8 trades are kinds of work like the others here; they alone have rate cards
 * and fixed questions, which stay theirs.
 */
export const WorkGroup = z.enum([
  "house_help",
  "home_repairs",
  "appliances",
  "electronics",
  "cleaning",
  "care",
  "personal",
  "vehicles",
  "outdoor",
  "teaching",
  "events",
]);
export type WorkGroup = z.infer<typeof WorkGroup>;

/** A kind of work: one of the trades, or one of the kinds outside them. */
export type WorkKind = Trade | WorkCategory;

const T = Trade.enum;
const C = WorkCategory.enum;

export const GROUP_KINDS: Readonly<Record<WorkGroup, readonly WorkKind[]>> = {
  house_help: [T.maid, T.cook, C.laundry, C.deep_cleaning],
  home_repairs: [
    T.electrician,
    T.plumber,
    T.carpenter,
    T.painter,
    T.ac_technician,
    C.mason,
    C.tile_work,
    C.welder,
    C.aluminium_glass_work,
    C.locksmith,
    C.waterproofing,
  ],
  appliances: [
    C.tv_repair,
    C.fridge_repair,
    C.washing_machine_repair,
    C.microwave_repair,
    C.geyser_repair,
    C.water_purifier_service,
    C.gas_stove_repair,
    C.small_appliance_repair,
    C.air_cooler_repair,
  ],
  electronics: [C.inverter_service, C.mobile_repair, C.computer_repair, C.cctv_installation, C.internet_setup],
  cleaning: [C.pest_control, C.sofa_cleaning, C.water_tank_cleaning],
  care: [C.babysitter, C.elder_care, C.home_nurse, C.physiotherapist, C.pet_care],
  personal: [C.tailor, C.beautician, C.barber, C.mehendi_artist, C.cobbler],
  vehicles: [T.driver, C.car_mechanic, C.bike_mechanic, C.car_wash],
  outdoor: [C.gardener, C.packers_movers, C.security_guard],
  teaching: [
    C.school_tutor,
    C.spoken_english_teacher,
    C.computer_teacher,
    C.music_teacher,
    C.dance_teacher,
    C.yoga_teacher,
    C.swimming_teacher,
    C.driving_instructor,
    C.gym_trainer,
  ],
  events: [C.photographer, C.caterer, C.event_decorator, C.priest],
};

export const isTradeKind = (kind: string): kind is Trade => Trade.safeParse(kind).success;

/** The group a kind of work is in. Every kind is in exactly one. */
export function groupOf(kind: WorkKind): WorkGroup {
  const group = WorkGroup.options.find((g) => GROUP_KINDS[g].includes(kind));
  if (!group) throw new Error(`no group for ${kind}`);
  return group;
}
