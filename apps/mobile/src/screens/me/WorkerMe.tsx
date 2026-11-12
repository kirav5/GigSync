import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { Screen } from "../../state.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import { MeHead } from "./MeHead.js";
import { CardRow, HelpRow, LanguageRow, type OpenScreen, PrivacyRow, SettingsLink } from "./rows.js";

/**
 * A worker's Me tab (design P1): who they are, then everything about them in one list, in the order they need it: their
 * card, their record, About me, Privacy, Help, moving to a new city, their language and Settings.
 */
export function WorkerMe({ account, onOpen }: { account: Account; onOpen: OpenScreen }) {
  const { t } = useI18n();
  return (
    <>
      <MeHead account={account} saved={undefined} />
      <ListCard>
        <CardRow onOpen={onOpen} />
        <ListRow icon="doc" title={t("me.record")} sub={t("me.record_sub")} onClick={() => onOpen(Screen.myRecord)} />
        <ListRow icon="user" title={t("nav.about")} sub={t("me.about_worker")} onClick={() => onOpen(Screen.about)} />
        <PrivacyRow onOpen={onOpen} />
        <HelpRow onOpen={onOpen} />
        <ListRow icon="pin" title={t("me.moving")} sub={t("me.moving_sub")} onClick={() => onOpen(Screen.landing)} />
        <LanguageRow onOpen={onOpen} />
        <SettingsLink onOpen={onOpen} />
      </ListCard>
    </>
  );
}
