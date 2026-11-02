import { type Embedder, listedSkill, log, type Ports, skillIndex } from "@gigsync/core";
import type { BoardSkill, Session } from "@gigsync/protocol";
import { apiClient } from "../adapters/account.js";

/**
 * The board's skill list for Find (ADR 0047 §4): fetched whole, kept a few minutes, and matched against the owner's
 * words on this phone, so the words never reach the server. A failed fetch matches nothing; the need then goes on as
 * one outside the list, as before.
 */

/** How long a fetched list is used before it is fetched again. */
const LIST_TTL_MS = 5 * 60 * 1000;

let kept: { at: number; list: readonly BoardSkill[]; index?: ReturnType<typeof skillIndex> } | undefined;

async function boardSkills(session: Session, embedder: Embedder | undefined, now: number) {
  if (kept && now - kept.at < LIST_TTL_MS) return kept;
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

/**
 * The skill the owner's words ask for: among the one worker's skills when the need is addressed to them, else the
 * board's list; undefined when none is close.
 */
export async function skillAsked(
  ports: Ports,
  session: Session,
  words: string,
  only?: readonly BoardSkill[],
): Promise<BoardSkill | undefined> {
  if (only) return listedSkill(words, only);
  const { list, index } = await boardSkills(session, ports.embedder, ports.clock.now().getTime());
  return listedSkill(words, list, index);
}
