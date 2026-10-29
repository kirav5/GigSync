import { type Colleague, ColleagueState } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { LinkChip } from "../mentor/LinkChip.js";
import { useColleagues } from "./context.js";
import { COLLEAGUE_LIST, ColleagueMode, type ColleaguePlace } from "./place.js";
import "./colleagues.css";

/**
 * One row per colleague: name, trades, and their new notes or that their phone has not answered yet. A row opens the
 * colleague (`onOpen`). With `onCancel`, a request their phone never answered (a code that had run out is ignored
 * there, silently) has a Cancel beside it instead, so a new scan can start again.
 */
export function ColleagueRows({
  colleagues,
  onOpen,
  onCancel,
}: {
  colleagues: readonly Colleague[];
  onOpen: (c: Colleague) => void;
  onCancel?: (c: Colleague) => void;
}) {
  const { t, plural } = useI18n();
  return (
    <ul className="colleague-rows" aria-label={t("colleague.title")}>
      {colleagues.map((c) => {
        const name = c.card.name;
        const linked = c.state === ColleagueState.linked;
        const body = (
          <>
            <span className="avatar" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="who">
              <strong>{name}</strong>
              <span className={C.muted}>
                {linked ? c.card.trades.map((tr) => t(`trade.${tr}`)).join(", ") : t("colleague.asked", { name })}
              </span>
              <LinkChip colleague={c} now={new Date()} />
            </span>
            {c.unread > 0 && <span className="colleague-unread">{plural("colleague.unread", c.unread)}</span>}
          </>
        );
        return (
          <li key={c.user}>
            {linked || !onCancel ? (
              <button type={C.button} className="colleague-row" onClick={() => onOpen(c)}>
                {body}
              </button>
            ) : (
              <div className="colleague-row">
                {body}
                <button type={C.button} className={`${C.quiet} end`} onClick={() => onCancel(c)}>
                  {t("colleague.cancel")}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Profile's Colleagues: what they are for, the list with new notes counted, and the two ways to link one, each
 * opening the Colleagues screen.
 */
export function ColleaguesSection({ onOpen }: { onOpen: (place: ColleaguePlace) => void }) {
  const { t } = useI18n();
  const { colleagues } = useColleagues();
  const title = t("colleague.title");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <span className={C.muted}>{t("colleague.about")}</span>
      {colleagues.length > 0 && (
        <ColleagueRows
          colleagues={colleagues}
          onOpen={(c) =>
            // A request still waiting opens the Colleagues list, where it can be cancelled.
            onOpen(c.state === ColleagueState.linked ? { mode: ColleagueMode.thread, user: c.user } : COLLEAGUE_LIST)
          }
        />
      )}
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={() => onOpen({ mode: ColleagueMode.show })}>
          {t("colleague.show_code")}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => onOpen({ mode: ColleagueMode.scan })}>
          {t("colleague.scan")}
        </button>
      </div>
    </section>
  );
}
