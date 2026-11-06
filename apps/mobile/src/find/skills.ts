import { type Embedder, listedSkill, log, type Ports, pickSkill, skillIndex } from "@gigsync/core";
import type { BoardSkill, Session } from "@gigsync/protocol";
import { apiClient } from "../adapters/account.js";

/**
 * The board's skill list for Find (ADR 0047 §4, ADR 0057): fetched whole, kept a few minutes, and matched against the
 * owner's words by name, by meaning on this phone, then by the model; a search sends only a key from the list. A failed
 * fetch matches nothing; the need then goes on as one outside the list, as before.
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
 * board's list; by its name in the words, then by what the words mean to the model, so "my tv not working" finds a
 * worker's "TV repair". Undefined when none would do the job.
 */
export async function skillAsked(
  ports: Ports,
  session: Session,
  words: string,
  only?: readonly BoardSkill[],
): Promise<BoardSkill | undefined> {
  if (only) return (await listedSkill(words, only)) ?? pickSkill(ports.model, words, only);
  const { list, index } = await boardSkills(session, ports.embedder, ports.clock.now().getTime());
  return (await listedSkill(words, list, index)) ?? pickSkill(ports.model, words, list);
}
