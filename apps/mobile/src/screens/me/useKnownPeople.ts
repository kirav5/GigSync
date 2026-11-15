import {
  type BlockedPerson,
  type GigDevice,
  type KnownPerson,
  listMemory,
  log,
  MemoryItemKind,
  type Person,
  type Ports,
} from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import { useCallback, useEffect, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { memoryOwner } from "../memory/owner.js";

/** Someone the owner knows (ADR 0031's "know"), with what the agent remembers of their jobs together, if anything. */
export interface KnownOne {
  person: KnownPerson;
  memory: Person | undefined;
}

/** The people page's two lists: everyone the owner knows, and everyone they blocked. Undefined until read. */
export interface KnownPeople {
  known: readonly KnownOne[] | undefined;
  blocked: readonly BlockedPerson[] | undefined;
  /** Reads both again, after a block or an unblock moved someone from one list to the other. */
  refresh: () => void;
}

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : String(err) });

/** The people the agent remembers, by user: the count of signed jobs and the last one's date. */
async function remembered(ports: Ports, account: Account): Promise<ReadonlyMap<UserId, Person>> {
  const items = await listMemory(memoryOwner(ports, account));
  return new Map(items.flatMap((i) => (i.kind === MemoryItemKind.person ? [[i.person.user, i.person] as const] : [])));
}

/**
 * Everyone the owner had a job signed with or a mentor link to, blocked ones left out (core mentor/known.ts), each with
 * the agent's memory of their jobs together; and, apart, everyone they blocked. Read again after each sync, which may
 * add a signed job, and on `refresh`.
 */
export function useKnownPeople(
  ports: Ports,
  account: Account,
  device: GigDevice,
  syncedAt: Date | undefined,
): KnownPeople {
  const [known, setKnown] = useState<readonly KnownOne[]>();
  const [blocked, setBlocked] = useState<readonly BlockedPerson[]>();
  const [asked, setAsked] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: read again after each sync and each refresh.
  useEffect(() => {
    let live = true;
    Promise.all([device.mentors.people(), device.mentors.blocked(), remembered(ports, account)])
      .then(([people, blocks, memory]) => {
        if (!live) return;
        setKnown(people.map((p) => ({ person: p, memory: memory.get(p.user) })));
        setBlocked(blocks);
      })
      .catch((err: unknown) => log.warn("known people unread", failure(err)));
    return () => {
      live = false;
    };
  }, [ports, account, device, syncedAt, asked]);

  const refresh = useCallback(() => setAsked((n) => n + 1), []);
  return { known, blocked, refresh };
}
