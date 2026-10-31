import type { UserId } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { LinkChip } from "./LinkChip.js";
import { useLinks } from "./links.js";
import "./mentor.css";

/**
 * Privacy's mentor links: what they are, and one row per live link (name, trades, who they are to this owner, days
 * left, new notes), each opening the link's thread. Nothing at all while there is no link.
 */
export function LinksSection({ onOpen }: { onOpen: (user: UserId) => void }) {
  const { t, plural } = useI18n();
  const { links } = useLinks();
  if (links.length === 0) return null;
  const title = t("mentor.links");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <span className={C.muted}>{t("mentor.links_about")}</span>
      <ul className="link-rows" aria-label={title}>
        {links.map((l) => (
          <li key={l.user}>
            <button type={C.button} className="link-row" onClick={() => onOpen(l.user)}>
              <span className="avatar" aria-hidden="true">
                {l.card.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="who">
                <strong>{l.card.name}</strong>
                <span className={C.muted}>{l.card.trades.map((tr) => t(`trade.${tr}`)).join(", ")}</span>
                <LinkChip link={l} now={new Date()} />
              </span>
              {l.unread > 0 && <span className="link-unread">{plural("mentor.unread", l.unread)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
