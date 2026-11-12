import type { OwnerTask } from "@gigsync/core";
import type { EngagementId } from "@gigsync/protocol";
import { useState } from "react";

/** The decisions already seen open, and each row's open or closed state as the owner left it. */
interface Rows {
  seen: ReadonlySet<string>;
  open: ReadonlyMap<EngagementId, boolean>;
}

const NONE: Rows = { seen: new Set(), open: new Map() };

/**
 * The rows as last left, kept beyond the Jobs tab's screen: a worker who went to About me to add a UPI ID comes back
 * to the job still open. Keyed by job, so another owner on the phone has nothing of it.
 */
let kept: Rows = NONE;

/**
 * Which job rows are open. A new decision opens its row, so answering it is one tap; from then on the row stays as the
 * owner leaves it, open even once the job moves on to another section, so what came of the decision (signed, the
 * contact) is in view, and stays so on coming back to the tab. A decision that comes back after it was answered opens
 * its row again.
 */
export function useOpenRows(tasks: readonly OwnerTask[]): {
  isOpen: (id: EngagementId) => boolean;
  toggle: (id: EngagementId) => void;
} {
  const [rows, setState] = useState<Rows>(() => kept);
  const setRows = (next: Rows | ((r: Rows) => Rows)) =>
    setState((r) => {
      kept = typeof next === "function" ? next(r) : next;
      return kept;
    });
  const fresh = tasks.filter((k) => !rows.seen.has(k.id));
  // Every seen decision is still open exactly when the counts add up; one answered since leaves `seen` for good.
  const gone = rows.seen.size + fresh.length !== tasks.length;
  if (fresh.length > 0 || gone) {
    const open = new Map(rows.open);
    for (const k of fresh) open.set(k.engagement, true);
    setRows({ seen: new Set(tasks.map((k) => k.id)), open });
  }
  return {
    isOpen: (id) => rows.open.get(id) ?? fresh.some((k) => k.engagement === id),
    toggle: (id) => setRows((r) => ({ ...r, open: new Map(r.open).set(id, !(r.open.get(id) ?? false)) })),
  };
}
