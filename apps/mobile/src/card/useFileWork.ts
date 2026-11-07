import { log, type Ports } from "@gigsync/core";
import type { Lang, Skill, Trade } from "@gigsync/protocol";
import type { Account } from "../adapters/account.js";
import { accountDraft, publishCard } from "./publish.js";

/**
 * A worker's yes to "Is this TV repair?" on a card already on the board saves at once (ADR 0059): with no Publish to
 * remember, the skill is found with every other wording of the work from now on. A card off the board, or none yet,
 * waits for Publish as the rest of the form does.
 */
export function useFileWork(ports: Ports, account: Account, lang: Lang, onSaved: (a: Account) => void) {
  return (work: { trades: Trade[]; skills: Skill[] }) => {
    if (!account.worker || account.listed === false) return;
    void publishCard(ports, account, { ...accountDraft(account), ...work }, lang)
      .then(onSaved)
      .catch((err: unknown) =>
        log.warn("filing a skill not saved", { error: err instanceof Error ? err.name : typeof err }),
      );
  };
}
