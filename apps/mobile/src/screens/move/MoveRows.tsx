import type { MessageKey } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import "../../ui/install.css";

/** One of Settings' rows to a screen: the whole card is the button, as the row to Install (ui/install.css). */
function Row({
  icon,
  title,
  about,
  onOpen,
}: {
  icon: IconName;
  title: MessageKey;
  about: MessageKey;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  return (
    <button type={C.button} className={`${C.card} install-row`} onClick={onOpen}>
      <span className="install-badge" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="install-text">
        <span className="install-title">{t(title)}</span>
        <span className="install-about">{t(about)}</span>
      </span>
      <span className="install-go" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

/** Settings' two ways of moving between phones (ADR 0037): show this phone's code, or scan the old phone's. */
export function MoveRows({ onMoveOut, onMoveIn }: { onMoveOut: () => void; onMoveIn: () => void }) {
  return (
    <>
      <Row icon="phone" title="phone.move_out" about="phone.move_out_about" onOpen={onMoveOut} />
      <Row icon="qr" title="phone.move_in" about="phone.move_in_about" onOpen={onMoveIn} />
    </>
  );
}
