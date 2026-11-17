import { type AddressChoice, addressChoice, listAddresses, log, type Ports } from "@gigsync/core";
import type { SavedAddress } from "@gigsync/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { addressesNeed } from "./needStore.js";

/**
 * The household's saved addresses for Find (ADR 0045): read once, and added to as the owner saves one from the chat,
 * which then offers it at the "where" question. Empty, not missing, when none are saved or they cannot be read.
 */
export function useAddresses(
  ports: Ports,
  chat: string,
  offered: readonly AddressChoice[] | undefined,
): {
  saved: readonly SavedAddress[] | undefined;
  added: (chat: string, address: SavedAddress) => void;
} {
  const [saved, setSaved] = useState<SavedAddress[]>();
  const current = useRef<SavedAddress[] | undefined>(undefined);
  current.current = saved;
  useEffect(() => {
    listAddresses(ports.storage)
      .then(setSaved)
      .catch((err: unknown) => {
        log.warn("reading saved addresses failed", { error: err instanceof Error ? err.name : typeof err });
        setSaved([]);
      });
  }, [ports]);
  // A chat begun before an address was saved (in Settings, say) offers the ones saved now.
  useEffect(() => {
    if (!saved) return;
    const now = saved.map(addressChoice);
    if (now.map((a) => a.id).join() !== (offered ?? []).map((a) => a.id).join()) addressesNeed(chat, now);
  }, [saved, offered, chat]);
  // The chat learns the new address now, before the caller taps it: inside a state updater it would run only at the
  // next render, after the tap, and the tap would find no such address and leave the chat stuck at "where". An address
  // saved again (its pin put on the door) takes its old place, so the worker gets the new pin.
  const added = useCallback((chat: string, address: SavedAddress) => {
    const before = current.current ?? [];
    const next = before.some((a) => a.id === address.id)
      ? before.map((a) => (a.id === address.id ? address : a))
      : [...before, address];
    current.current = next;
    addressesNeed(chat, next.map(addressChoice));
    setSaved(next);
  }, []);
  return { saved, added };
}
