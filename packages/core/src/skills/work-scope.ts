import type { Trade, WorkCategory } from "@gigsync/protocol";
import type { WorkPick } from "./work-list.js";

/**
 * What a kind of work covers, in a few words, for the models that pick work from the list (Find's reader and the card
 * interview's): the line a list of names alone could not draw, so plaster is a mason's and not a painter's, and a
 * water tank is cleaned by its own workers and not by a maid or a plumber. Only the kinds that a name alone lets a
 * small model confuse have one; the rest are clear by name.
 */

export const TRADE_SCOPE: Readonly<Record<Trade, string>> = {
  electrician: "home wiring, fans, lights, switches, sockets",
  plumber: "taps, pipes, drains, toilets, leaking fittings",
  maid: "everyday house cleaning: sweeping, mopping, washing dishes, laundry",
  carpenter: "wood, doors, furniture, cupboards",
  ac_technician: "air conditioners only",
  painter: "painting or whitewashing (putai) walls and rooms",
  cook: "cooking meals",
  driver: "driving the household's own vehicle",
};

export const CATEGORY_SCOPE: Readonly<Partial<Record<WorkCategory, string>>> = {
  tailor: "stitching clothes and blouses, alterations",
  mason: "brick, cement and plaster work, cracks in walls",
  waterproofing: "leaks and seepage through roofs, terraces and walls",
  water_tank_cleaning: "cleaning drinking-water tanks and sumps; an aquarium is not one",
  deep_cleaning: "a thorough one-time clean of a whole home",
  sofa_cleaning: "shampooing sofas, carpets and mattresses, not the house",
  car_wash: "washing and cleaning cars and bikes",
  gas_stove_repair: "gas stoves, hobs and burners",
  geyser_repair: "water heaters",
  small_appliance_repair: "mixers, irons and other small appliances",
};

/** What a line of the list covers, when its name alone does not say; a worker's own words say it themselves. */
export const scopeOf = (pick: WorkPick): string | undefined =>
  "trade" in pick ? TRADE_SCOPE[pick.trade] : "category" in pick ? CATEGORY_SCOPE[pick.category] : undefined;
