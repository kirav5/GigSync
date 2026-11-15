import { t as say } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { Screen } from "../../state.js";
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
  return (
    <ListRow
      icon="qr"
      title={t(isWorker ? "nav.card" : "profile.my_qr")}
      sub={t(isWorker ? "me.card_sub" : "profile.my_qr_sub")}
      onClick={() => onOpen(Screen.card)}
    />
  );
}

/** People you know: everyone the owner worked with, to ask again, block or unblock. */
export function PeopleRow({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return (
    <ListRow icon="people" title={t("me.people")} sub={t("me.people_sub")} onClick={() => onOpen(Screen.people)} />
  );
}

/** Alerts: what happened, day by day. The decisions waiting are counted on the Jobs tab, not here again. */
export function AlertsRow({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return (
    <ListRow icon="bell" title={t("tabs.alerts")} sub={t("me.alerts_sub")} onClick={() => onOpen(Screen.alerts)} />
  );
}

/** Privacy: who sees what. */
export function PrivacyRow({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return (
    <ListRow icon="shield" title={t("nav.privacy")} sub={t("me.privacy_sub")} onClick={() => onOpen(Screen.privacy)} />
  );
}

/**
 * Help (workers): a mentor, a problem with a job, and moving to a new city; with the unread mentor notes said under it
 * while there are any, as the mentor links live there.
 */
export function HelpRow({ onOpen }: { onOpen: OpenScreen }) {
  const { t, plural } = useI18n();
  const { unread } = useLinks();
  const sub = unread > 0 ? plural("mentor.unread", unread) : t("me.help_sub");
  return <ListRow icon="help" title={t("me.help")} sub={sub} onClick={() => onOpen(Screen.help)} />;
}

/** Language, with the one in use named in its own script. */
export function LanguageRow({ onOpen }: { onOpen: OpenScreen }) {
  const { t, lang } = useI18n();
  return (
    <ListRow
      icon="globe"
      title={t("me.language")}
      end={<span lang={lang}>{say(lang, `lang.${lang}`)}</span>}
      onClick={() => onOpen(Screen.language)}
    />
  );
}

/** Settings: the look, alerts, the agent's model and bargaining, and this phone. */
export function SettingsLink({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return (
    <ListRow icon="gear" title={t("nav.settings")} sub={t("me.settings_sub")} onClick={() => onOpen(Screen.settings)} />
  );
}
