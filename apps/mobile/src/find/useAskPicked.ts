import { type GigDevice, log, type NeedState, type Ports } from "@gigsync/core";
import type { SavedAddress } from "@gigsync/protocol";
import { useState } from "react";
import { offerAlerts } from "../adapters/push.js";
import type { I18n } from "../i18n.js";
import { errorKey } from "../ui/errorKey.js";
import { askWorkers, needOf } from "./ask.js";
import { needAsked, needSay } from "./needStore.js";
import type { FoundTurn } from "./needTurns.js";
import { ASKED } from "./useNeedSearch.js";

const failure = (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) });

interface AskDeps {
  ports: Ports;
  device: GigDevice;
  i18n: I18n;
  state: NeedState | undefined;
  /** The chat the workers were found in, which hears that they were asked. */
  open: string;
  saved: readonly SavedAddress[] | undefined;
  onAsked: () => void;
}

/**
 * Asking the workers the owner ticked in a found turn: the need as the chat has it, sent to each (ADR 0035), then the
 * chat says so and the app moves on; a failure is said in the chat. `busy` while the asks go out.
 */
export function useAskPicked({ ports, device, i18n, state, open, saved, onAsked }: AskDeps) {
  const [busy, setBusy] = useState(false);
  async function ask(turn: FoundTurn) {
    // Asking workers is when this household starts to have news to hear about: the browser may ask, once.
    void offerAlerts();
    const need = state && needOf(state, i18n, ports.clock.now(), saved);
    if (busy || !need) return;
    const chat = open;
    setBusy(true);
    try {
      await askWorkers(
        ports,
        device,
        need,
        turn.workers.filter((w) => turn.picked.includes(w.user)),
      );
      needAsked(chat, ASKED);
      onAsked();
    } catch (err) {
      log.warn("asking workers failed", failure(err));
      needSay(chat, { key: errorKey(err) });
    } finally {
      setBusy(false);
    }
  }
  return { busy, ask };
}
