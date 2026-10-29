import type { MemoryOwner, Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { AREAS } from "../../ui/places.js";

/** The signed-in owner's memory on this phone. */
export const memoryOwner = (ports: Ports, account: Account): MemoryOwner => ({
  storage: ports.storage,
  me: { user: account.session.user },
});

/** The pilot area at a remembered place: requests carry an area's centre exactly, so it matches by value. */
export const areaAt = (place: { lat: number; lon: number }) =>
  AREAS.find((a) => a.lat === place.lat && a.lon === place.lon);
