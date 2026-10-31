import {
  DEFAULT_ANSWER_FROM_MEMORY,
  householdKnown,
  log,
  type NeedConfig,
  type NeedMemory,
  type Ports,
} from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { areaAt, memoryOwner } from "../memory/owner.js";

/**
 * The owner's remembered area and stable facts, each marked fresh or a year old, with their "Ask me first" or "Answer
 * for me" setting: what Find's agent offers or fills in. Empty when none or unreadable.
 */
export async function needMemory(ports: Ports, account: Account): Promise<NeedMemory> {
  try {
    const known = await householdKnown({ ...memoryOwner(ports, account), clock: ports.clock });
    const area = known.area ? areaAt(known.area.place) : undefined;
    return {
      mode: known.mode,
      facts: known.facts,
      ...(area && known.area ? { area: { value: area.key, fresh: known.area.fresh } } : {}),
    };
  } catch (err) {
    log.warn("reading memory for Find failed", { error: err instanceof Error ? err.name : typeof err });
    return { mode: DEFAULT_ANSWER_FROM_MEMORY, facts: {} };
  }
}

/** A config that keeps what the agent remembers across a change of language. */
export const withMemory = (config: NeedConfig, remembered: NeedMemory | undefined): NeedConfig =>
  remembered ? { ...config, remembered } : config;
