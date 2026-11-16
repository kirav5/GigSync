import { useI18n } from "../../i18n.js";
import { Screen } from "../../state.js";
import { C } from "../../ui/cls.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import { ListRow } from "../../ui/ListRow.js";
import { useLinks } from "../mentor/links.js";

/** Where a row of the profile sheet leads. */
export type OpenScreen = (s: Screen) => void;

/**
 * My card: a worker's card on the board and its QR, or, for a household, My QR, the code a worker scans (ADR 0034).
 * Either QR always shows the card as it is now: it carries a code, not the card.
 */
export function CardRow({ isWorker, onOpen }: { isWorker: boolean; onOpen: OpenScreen }) {
  const { t } = useI18n();
  return <ListRow icon="qr" title={t(isWorker ? "nav.card" : "profile.my_qr")} onClick={() => onOpen(Screen.card)} />;
}

/** People you know: everyone the owner worked with, to ask again, block or unblock. */
export function PeopleRow({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return <ListRow icon="people" title={t("me.people")} onClick={() => onOpen(Screen.people)} />;
}

/**
 * Help (workers): a mentor, a problem with a job, and moving to a new city; with the unread mentor notes said under it
 * while there are any, as the mentor links live there.
 */
export function HelpRow({ onOpen }: { onOpen: OpenScreen }) {
  const { t, plural } = useI18n();
  const { unread } = useLinks();
  const sub = unread > 0 ? plural("mentor.unread", unread) : undefined;
  return <ListRow icon="help" title={t("me.help")} sub={sub} onClick={() => onOpen(Screen.help)} />;
}

/** One of the three small buttons at the profile's foot, as the phone's own settings gear sits apart from the list. */
function Chip({ icon, title, onClick }: { icon: IconName; title: string; onClick: () => void }) {
  return (
    <button type={C.button} className="profile-chip" onClick={onClick}>
      <Icon name={icon} size={18} />
      {title}
    </button>
  );
}

/** Language: its name in the app's language, which is the one in use. */
export function LanguageChip({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return <Chip icon="globe" title={t("me.language")} onClick={() => onOpen(Screen.language)} />;
}

/** Privacy: who sees what. */
export function PrivacyChip({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return <Chip icon="shield" title={t("nav.privacy")} onClick={() => onOpen(Screen.privacy)} />;
}

/** Settings: the look, alerts, the assistant's model and bargaining, and this phone. */
export function SettingsChip({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return <Chip icon="gear" title={t("nav.settings")} onClick={() => onOpen(Screen.settings)} />;
}
