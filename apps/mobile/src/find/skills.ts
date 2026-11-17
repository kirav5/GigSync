import { type Embedder, log, type Ports, skillIndex } from "@gigsync/core";
import type { BoardSkill, Session } from "@gigsync/protocol";
import { apiClient } from "../adapters/account.js";

/**
 * The board's skill list for Find (ADR 0047 §4, ADR 0059): fetched whole and kept a few minutes, and fetched again
 * before Find says nobody lists a kind of work, since a worker may have listed it a minute ago. The model reads it with
 * the owner's words; a search sends only a key or a kind of work. A failed fetch matches nothing, and the need goes on
 * as one outside the list, as before.
 */

/** How long a fetched list is used before it is fetched again. */
const LIST_TTL_MS = 5 * 60 * 1000;

let kept: { at: number; list: readonly BoardSkill[]; index?: ReturnType<typeof skillIndex> } | undefined;

async function boardSkills(session: Session, embedder: Embedder | undefined, now: number, fresh = false) {
  if (kept && !fresh && now - kept.at < LIST_TTL_MS) return kept;
  const list = await apiClient(session)
    .boardSkills()
    .catch((err: unknown) => {
      log.warn("skill list failed", { error: err instanceof Error ? err.name : String(err) });
      return undefined;
    });
  if (!list) return { at: now, list: [] };
  kept = { at: now, list, ...(embedder && list.length > 0 ? { index: skillIndex(embedder, list) } : {}) };
  return kept;
}

/** What the owner's words may be matched against: one worker's skills when the need is addressed to them, else the board's. */
export async function listedWork(
  ports: Ports,
  session: Session,
  only?: readonly BoardSkill[],
  fresh = false,
): Promise<{ list: readonly BoardSkill[]; index?: ReturnType<typeof skillIndex> }> {
  return only ? { list: only } : boardSkills(session, ports.embedder, ports.clock.now().getTime(), fresh);
}
