import { type AddressChoice, addressChoice, listAddresses, log, type Ports } from "@gigsync/core";
import type { SavedAddress } from "@gigsync/protocol";
import { useCallback, useEffect, useState } from "react";
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
  const added = useCallback((chat: string, address: SavedAddress) => {
    setSaved((all) => {
      const next = [...(all ?? []), address];
      addressesNeed(chat, next.map(addressChoice));
      return next;
    });
  }, []);
  return { saved, added };
}
