import {
  boardArrangement,
  type GigDevice,
  type Line,
  log,
  type MessageKey,
  NeedSlot,
  type NeedState,
  type Ports,
} from "@gigsync/core";
import type { SavedAddress } from "@gigsync/protocol";
import { useEffect } from "react";
import type { Account } from "../adapters/account.js";
import type { I18n } from "../i18n.js";
import { errorKey } from "../ui/errorKey.js";
import { askedTo, askWorkers, needOf, searchBoard, whereOf } from "./ask.js";
import { claimSearch } from "./findChats.js";
import { needAsked, needFound, needSearchFailed } from "./needStore.js";

/** What the search needs from Find's chat. */
interface SearchDeps {
  state: NeedState | undefined;
  open: string;
  account: Account;
  i18n: Pick<I18n, "t" | "date">;
  ports: Ports;
  device: GigDevice;
  onAsked: () => void;
  saved: readonly SavedAddress[] | undefined;
}

export const ASKED: Line = { key: "need.asked" };
/** Said if a yes ever comes before the need is whole: the readback asks again. */
const INCOMPLETE: MessageKey = "need.again";
const failure = (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) });

/**
 * The owner said yes to the readback: the board is searched once, wherever they are by the time it answers, for
 * workers who work at the need's day and hour (ADR 0050 §3); or, for a chat addressed to one worker, they are asked.
 */
export function useNeedSearch({ state, open, account, i18n, ports, device, onAsked, saved }: SearchDeps): void {
  useEffect(() => {
    if (state?.slot !== NeedSlot.done || !(state.draft.trade || state.draft.skill)) return;
    const claim = claimSearch(open);
    if (claim === undefined) return;
    if (state.to) {
      const sent = needOf(state, i18n, ports.clock.now(), saved);
      if (!sent) return needSearchFailed(claim, INCOMPLETE);
      askWorkers(ports, device, sent, [askedTo(state.to)])
        .then(() => {
          needAsked(claim.chat, ASKED);
          onAsked();
        })
        .catch((err: unknown) => {
          log.warn("asking the worker failed", failure(err));
          needSearchFailed(claim, errorKey(err));
        });
      return;
    }
    // Where the need is (ADR 0045): its saved address or pilot area; never a fallback to another area.
    const at = whereOf(state.draft, saved ?? []);
    if (!at) return needSearchFailed(claim, INCOMPLETE);
    searchBoard(account, state.draft, at.area, state.radius_km, boardArrangement(state.draft))
      .then((workers) => needFound(claim, workers))
      .catch((err: unknown) => {
        log.warn("search failed", failure(err));
        needSearchFailed(claim, errorKey(err));
      });
  }, [state, open, account, i18n, ports, device, onAsked, saved]);
}
