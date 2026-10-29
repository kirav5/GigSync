import { listMemory, log, MemoryItemKind, type NeedConfig, type NeedMemory, type Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { areaAt, memoryOwner } from "../memory/owner.js";

/** The owner's remembered area and stable facts, for Find's "same as last time" chips; empty when none or unreadable. */
export async function needMemory(ports: Ports, account: Account): Promise<NeedMemory> {
  const remembered: NeedMemory = { facts: {} };
  try {
    for (const item of await listMemory(memoryOwner(ports, account))) {
      if (item.kind === MemoryItemKind.fact) remembered.facts[item.fact] = item.value;
      const area = item.kind === MemoryItemKind.area ? areaAt(item.place) : undefined;
      if (area) remembered.area = area.key;
    }
  } catch (err) {
    log.warn("reading memory for Find failed", { error: err instanceof Error ? err.name : typeof err });
  }
  return remembered;
}

/** A config that keeps what the agent remembers across a change of language. */
export const withMemory = (config: NeedConfig, remembered: NeedMemory | undefined): NeedConfig =>
  remembered ? { ...config, remembered } : config;
