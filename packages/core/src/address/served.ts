import type { Place, ServedCity } from "@gigsync/protocol";
import { kmBetween } from "../estimate/areas.js";
import { finder, firstIn, normalize } from "../interview/normalize.js";
import { CITY_AREA } from "../landing/cities.js";
import { Collection, type Storage } from "../ports.js";

/**
 * Addresses by chat (ADR 0050 §6): whether GigSync serves a place, the words that ask to add, change or pick an
 * address, and which saved address the household is using now. All on the phone: the words are read by lists, so
 * every phone understands them, model or not.
 */

/**
 * GigSync serves a place inside one of its cities' circles; anywhere else, "not in your area yet". The cities come
 * from the directory (ADR 0061); before the phone has them, the city the app shipped with stands in.
 */
export const served = (point: Place, cities?: readonly ServedCity[]): boolean =>
  (cities ?? Object.values(CITY_AREA)).some((city) => kmBetween(point, city.centre) <= city.radius_km);

/** Words for an address, and for doing something to one, in each language and as Indians type them. */
const ADDRESS_WORDS = ["address", "location", "pata", "पता", "एड्रेस", "लोकेशन", "ವಿಳಾಸ", "ಅಡ್ರೆಸ್", "ಲೊಕೇಶನ್"];
const CHANGE_WORDS = [
  "change",
  "add",
  "new",
  "update",
  "edit",
  "another",
  "different",
  "switch",
  "select",
  "choose",
  "other",
  "badlo",
  "badal",
  "naya",
  "nayi",
  "जोड़",
  "बदल",
  "बदलो",
  "नया",
  "नई",
  "दूसरा",
  "चुन",
  "ಬದಲಿಸ",
  "ಬದಲಾಯಿಸ",
  "ಹೊಸ",
  "ಸೇರಿಸ",
  "ಬೇರೆ",
  "ಆರಿಸ",
];
const ADDRESS = ADDRESS_WORDS.map(finder);
const CHANGE = CHANGE_WORDS.map(finder);

/** The owner asks to add, change or pick an address ("change my address", "नया पता जोड़ो", "ವಿಳಾಸ ಬದಲಿಸಿ"). */
export function addressAsked(text: string): boolean {
  const said = normalize(text);
  return firstIn(said, ADDRESS) >= 0 && firstIn(said, CHANGE) >= 0;
}

/** Where the address the household is using now is kept, among the owner's settings. */
const SELECTED_KEY = "address_selected";

/** The id of the address the household picked to use, when they picked one. */
export const selectedAddressId = async (storage: Storage): Promise<string | undefined> =>
  (await storage.get<{ id: string }>(Collection.settings, SELECTED_KEY))?.id;

/** The household picks an address to use: Find shows it at the top and offers it first. */
export const selectAddress = (storage: Storage, id: string): Promise<void> =>
  storage.put(Collection.settings, SELECTED_KEY, { id });
