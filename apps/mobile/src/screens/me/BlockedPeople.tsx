import type { BlockedPerson, GigDevice } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ListCard } from "../../ui/ListRow.js";
import { PersonRow } from "./PersonRow.js";
import { UnblockSheet } from "./PersonSheets.js";

interface Props {
  device: GigDevice;
  blocked: readonly BlockedPerson[];
  /** Runs the owner's action, then syncs. */
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  onChanged: () => void;
}

/**
 * Everyone the owner blocked, newest first, in their own list under the people they know: who (by the name this phone
 * knew them by), when, and Unblock, which asks once and lets them back in. Nothing shows while nobody is blocked.
 */
export function BlockedPeople({ device, blocked, run, onChanged }: Props) {
  const { t, date } = useI18n();
  const [asking, setAsking] = useState<BlockedPerson>();
  if (blocked.length === 0) return null;
  const nameOf = (p: BlockedPerson) => p.name ?? t("me.blocked_unnamed");
  return (
    <>
      <ListCard label={t("me.blocked")}>
        {blocked.map((p) => (
          <PersonRow
            key={p.user}
            name={nameOf(p)}
            sub={t("me.blocked_on", { date: date(new Date(p.at)) })}
            end={
              // Its words are "Unblock"; its name adds whom, so a reader hears "Unblock, Ramesh".
              <button
                type={C.button}
                className={C.quiet}
                aria-label={`${t("me.unblock")} ${nameOf(p)}`}
                onClick={() => setAsking(p)}
              >
                {t("me.unblock")}
              </button>
            }
          />
        ))}
      </ListCard>
      <p className={C.faint}>{t("me.blocked_about")}</p>
      {asking && (
        <UnblockSheet
          name={nameOf(asking)}
          unblock={() => run(() => device.mentors.unblock(asking.user))}
          onChanged={onChanged}
          onClose={() => setAsking(undefined)}
        />
      )}
    </>
  );
}
