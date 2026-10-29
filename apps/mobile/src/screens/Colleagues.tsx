import { ColleagueState, type GigDevice, type MessageKey } from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import { useCallback, useMemo, useState } from "react";
import { type Account, colleagueCard } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { useColleagues } from "./colleague/context.js";
import { ColleagueRows } from "./colleague/List.js";
import { COLLEAGUE_LIST, ColleagueMode, type ColleaguePlace } from "./colleague/place.js";
import { colleagueProblem } from "./colleague/problems.js";
import { ScanCode } from "./colleague/ScanCode.js";
import { ShowCode } from "./colleague/ShowCode.js";
import { Thread } from "./colleague/Thread.js";

interface Props {
  account: Account;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  syncedAt: Date | undefined;
  place: ColleaguePlace;
  onPlace: (place: ColleaguePlace) => void;
}

/**
 * Workers this one met in person (round2-spec §3.3 B, C): link one by showing or scanning a code, then message them.
 * There is no search and no directory: the only way in is a code shown face to face. Under Profile, not a tab.
 */
export function Colleagues({ account, device, run, syncedAt, place, onPlace }: Props) {
  const { lang, t } = useI18n();
  const { colleagues, refresh } = useColleagues();
  const [problem, setProblem] = useState<MessageKey>();
  const card = useMemo(() => colleagueCard(account, lang), [account, lang]);
  /** The colleague just asked or linked here, for the line that says how it stands. */
  const [news, setNews] = useState<UserId>();
  const arrived = useCallback(
    (user: UserId) => {
      setNews(user);
      onPlace(COLLEAGUE_LIST);
    },
    [onPlace],
  );
  const toList = () => onPlace(COLLEAGUE_LIST);
  /** Gives up on a request the other phone never answered; a fresh scan asks again. */
  async function cancel(user: UserId) {
    try {
      await run(() => device.colleagues.unlink(user));
    } catch (err) {
      setProblem(colleagueProblem("cancelling a colleague request failed", err));
    }
    refresh();
  }

  if (place.mode === ColleagueMode.show) return <ShowCode device={device} card={card} onLinked={arrived} />;
  if (place.mode === ColleagueMode.scan)
    return <ScanCode device={device} me={account.session.user} card={card} onAsked={arrived} onCancel={toList} />;
  const open =
    place.mode === ColleagueMode.thread
      ? colleagues.find((c) => c.user === place.user && c.state === ColleagueState.linked)
      : undefined;
  if (open) return <Thread device={device} colleague={open} run={run} syncedAt={syncedAt} onUnlinked={toList} />;

  const fresh = colleagues.find((c) => c.user === news);
  return (
    <>
      <div className={C.stack}>
        <span className={C.muted}>{t("colleague.about")}</span>
        {fresh && (
          <p role="status">
            {t(fresh.state === ColleagueState.linked ? "colleague.linked" : "colleague.asked", {
              name: fresh.card.name,
            })}
          </p>
        )}
        {problem && <p className={C.error}>{t(problem)}</p>}
      </div>
      <div className={C.actions}>
        <button
          type={C.button}
          className={C.accent}
          onClick={() => onPlace({ mode: ColleagueMode.show, fromList: true })}
        >
          {t("colleague.show_code")}
        </button>
        <button
          type={C.button}
          className={C.secondary}
          onClick={() => onPlace({ mode: ColleagueMode.scan, fromList: true })}
        >
          {t("colleague.scan")}
        </button>
      </div>
      {colleagues.length === 0 ? (
        <div className={C.empty}>{t("colleague.empty")}</div>
      ) : (
        <ColleagueRows
          colleagues={colleagues}
          onOpen={(c) => onPlace({ mode: ColleagueMode.thread, user: c.user, fromList: true })}
          onCancel={(c) => void cancel(c.user)}
        />
      )}
    </>
  );
}
