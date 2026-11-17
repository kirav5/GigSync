import { z } from "zod";

/**
 * The kinds of work outside the trades (ADR 0059): one name behind every worker's own words, so "TV repair" and "TV
 * mechanic" are found together. A skill keeps the worker's words and may name one of these; a skill that fits none
 * stays as it is, found by its own name. Narrow on purpose: a TV-only worker must not get a washing machine.
 */
export const WorkCategory = z.enum([
  // Appliances
  "tv_repair",
  "fridge_repair",
  "washing_machine_repair",
  "microwave_repair",
  "geyser_repair",
  "water_purifier_service",
  "gas_stove_repair",
  "small_appliance_repair",
  "air_cooler_repair",
  // Electronics
  "inverter_service",
  "mobile_repair",
  "computer_repair",
  "cctv_installation",
  "internet_setup",
  // House work
  "pest_control",
  "deep_cleaning",
  "sofa_cleaning",
  "water_tank_cleaning",
  "waterproofing",
  "mason",
  "tile_work",
  "welder",
  "aluminium_glass_work",
  "locksmith",
  // Outdoor and moving
  "gardener",
  "packers_movers",
  "security_guard",
  // Vehicles
  "car_mechanic",
  "bike_mechanic",
  "car_wash",
  // Care
  "babysitter",
  "elder_care",
  "home_nurse",
  "physiotherapist",
  "pet_care",
  // Personal
  "tailor",
  "laundry",
  "beautician",
  "barber",
  "mehendi_artist",
  "cobbler",
  // Teaching
  "school_tutor",
  "spoken_english_teacher",
  "computer_teacher",
  "music_teacher",
  "dance_teacher",
  "yoga_teacher",
  "swimming_teacher",
  "driving_instructor",
  "gym_trainer",
  // Events
  "photographer",
  "caterer",
  "event_decorator",
  "priest",
]);
export type WorkCategory = z.infer<typeof WorkCategory>;
