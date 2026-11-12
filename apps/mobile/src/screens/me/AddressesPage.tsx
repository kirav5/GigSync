import type { Ports } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import { Addresses } from "../address/Addresses.js";

/** A household's saved addresses (ADR 0045) on a screen of their own, from Me (they were a section of Settings). */
export function AddressesPage({ ports, session }: { ports: Ports; session: Session }) {
  return <Addresses ports={ports} session={session} />;
}
