import { useSyncExternalStore } from "react";

/**
 * Whether Find's chat shows the address turn (ADR 0050 §6), and a count that moves each time the household's addresses
 * or their pick change, so the header and the chat read them again. Opened by the header or by words that ask to
 * change an address; closed once one is picked or saved, or on Done.
 */
interface Desk {
  open: boolean;
  /** Ask for the current location at once: the owner tapped "Use my current location". */
  locate: boolean;
  /** Moves on every change to the addresses or the pick. */
  version: number;
}

let desk: Desk = { open: false, locate: false, version: 0 };
const listeners = new Set<() => void>();

function set(next: Desk): void {
  desk = next;
  for (const listener of listeners) listener();
}

export const openAddressDesk = (): void => set({ ...desk, open: true, locate: false });
export const closeAddressDesk = (): void => set({ ...desk, open: false, locate: false });
export const locateFromDesk = (): void => set({ ...desk, open: true, locate: true });
export const addressesChanged = (): void => set({ ...desk, version: desk.version + 1 });

export function useAddressDesk(): Desk {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => desk,
  );
}
