import { listAddresses, log, type Storage, selectedAddressId } from "@gigsync/core";
import type { SavedAddress } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { useAddressDesk } from "./addressDesk.js";

/** The household's saved addresses and the one in use (the one picked, else the first saved), read again on changes. */
export function useAddressBook(storage: Storage): { saved: SavedAddress[]; inUse: SavedAddress | undefined } {
  const { version } = useAddressDesk();
  const [book, setBook] = useState<{ saved: SavedAddress[]; picked?: string | undefined }>({ saved: [] });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` is the signal to read the book again
  useEffect(() => {
    let live = true;
    Promise.all([listAddresses(storage), selectedAddressId(storage)])
      .then(([saved, picked]) => {
        if (live) setBook({ saved, picked });
      })
      .catch((err: unknown) =>
        log.warn("reading the address book failed", { error: err instanceof Error ? err.name : typeof err }),
      );
    return () => {
      live = false;
    };
  }, [storage, version]);
  const inUse = book.saved.find((a) => a.id === book.picked) ?? book.saved[0];
  return { saved: book.saved, inUse };
}
