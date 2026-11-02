import { type MemoryOwner, nearestPilotArea, type Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";

/** The signed-in owner's memory on this phone. */
export const memoryOwner = (ports: Ports, account: Account): MemoryOwner => ({
  storage: ports.storage,
  me: { user: account.session.user },
});

/** The pilot area at a remembered place: the nearest centre, as requests now carry a coarse point (ADR 0045). */
export const areaAt = (place: { lat: number; lon: number }) => nearestPilotArea(place);
