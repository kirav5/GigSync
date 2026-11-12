import {
  type GigDevice,
  type KnownPerson,
  listMemory,
  log,
  MemoryItemKind,
  type Person,
  type Ports,
} from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { memoryOwner } from "../memory/owner.js";

/** A worker the owner knows (ADR 0031's "know"), with what the agent remembers of their jobs together, if anything. */
export interface KnownWorker {
  person: KnownPerson;
  memory: Person | undefined;
}

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : String(err) });

/** The people the agent remembers, by user: the count of signed jobs and the last one's date. */
async function remembered(ports: Ports, account: Account): Promise<ReadonlyMap<UserId, Person>> {
  const items = await listMemory(memoryOwner(ports, account));
  return new Map(items.flatMap((i) => (i.kind === MemoryItemKind.person ? [[i.person.user, i.person] as const] : [])));
}

/**
 * Every worker the owner had a job signed with or a mentor link to, blocked ones left out (core mentor/known.ts),
 * each with the agent's memory of their jobs together; read again after each sync, which may add a signed job.
 * Undefined until read.
 */
export function useKnownWorkers(
  ports: Ports,
  account: Account,
  device: GigDevice,
  syncedAt: Date | undefined,
): readonly KnownWorker[] | undefined {
  const [workers, setWorkers] = useState<readonly KnownWorker[]>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: read again after each sync, which may add a signed job.
  useEffect(() => {
    let live = true;
    Promise.all([device.mentors.people(), remembered(ports, account)])
      .then(([people, memory]) => {
        const known = people.filter((p) => p.worker).map((p) => ({ person: p, memory: memory.get(p.user) }));
        if (live) setWorkers(known);
      })
      .catch((err: unknown) => log.warn("known people unread", failure(err)));
    return () => {
      live = false;
    };
  }, [ports, account, device, syncedAt]);

  return workers;
}
