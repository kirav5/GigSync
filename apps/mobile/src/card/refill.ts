import { CITY_RATES, keepQr, keptQr, log, type Ports, refillFromCard } from "@gigsync/core";
import { useEffect, useRef } from "react";
import { type Account, AccountRole, saveAccount } from "../adapters/account.js";
import { newPhoneClient } from "../adapters/newPhone.js";
import { myQrOf } from "../qr/myQr.js";
import { DEFAULT_RADIUS_KM } from "./publish.js";

/**
 * A worker signed in on a phone without their card's rules (a reinstall, a new phone moved to without scanning): their
 * card comes back from the board (ADR 0037 §4), all but the lowest price, which the worker is asked for (FloorAsk).
 * Undefined when there is nothing to refill: a household, rules already here, or no card on the board.
 */
export async function refillCard(ports: Ports, account: Account): Promise<Account | undefined> {
  if (account.role !== AccountRole.worker || account.worker) return undefined;
  const card = await newPhoneClient(account.session).myCard();
  if (!card) return undefined;
  const { worker, languages, about } = refillFromCard(card, { radius_km: DEFAULT_RADIUS_KM, rates: CITY_RATES });
  const next: Account = { ...account, worker, languages, about, listed: true };
  await saveAccount(ports, next);
  log.info("card refilled from the board", { trades: worker.trades.length });
  return next;
}

/** The owner's personal QR (ADR 0034) kept on this phone again, when it has none: the server gives back the live one. */
async function rememberQr(ports: Ports, account: Account): Promise<void> {
  if (await keptQr(ports.storage)) return;
  await keepQr(ports.storage, await myQrOf(account));
}

/** Once per signed-in owner: refills a worker's card and remembers the owner's QR. Failures wait for the next launch. */
export function useCardRefill(ports: Ports, account: Account, onAccount: (a: Account) => void): void {
  const latest = useRef({ account, onAccount });
  latest.current = { account, onAccount };
  const owner = account.session.user;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `owner` only exists to run this once per signed-in owner.
  useEffect(() => {
    let live = true;
    const { account: now } = latest.current;
    void (async () => {
      const refilled = await refillCard(ports, now);
      if (live && refilled) latest.current.onAccount(refilled);
      await rememberQr(ports, refilled ?? now);
    })().catch((err: unknown) =>
      log.warn("card refill failed", { error: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      live = false;
    };
  }, [ports, owner]);
}
