import { t as say } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { Screen } from "../../state.js";
import { ListRow } from "../../ui/ListRow.js";
import { useLinks } from "../mentor/links.js";

/** Where a row of Me leads. */
export type OpenScreen = (s: Screen) => void;

/** My card: a worker's card on the board and their QR, or a household's QR for workers to scan (ADR 0034). */
export function CardRow({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return <ListRow icon="qr" title={t("nav.card")} sub={t("me.card_sub")} onClick={() => onOpen(Screen.card)} />;
}

/** Privacy: who sees what. */
export function PrivacyRow({ onOpen }: { onOpen: OpenScreen }) {
  const { t } = useI18n();
  return (
    <ListRow icon="shield" title={t("nav.privacy")} sub={t("me.privacy_sub")} onClick={() => onOpen(Screen.privacy)} />
  );
}

/** Help (workers), with the unread mentor notes said under it while there are any: the mentor links live there. */
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
