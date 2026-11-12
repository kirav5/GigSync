import type { Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { Screen } from "../../state.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import { MeHead } from "./MeHead.js";
import { CardRow, LanguageRow, type OpenScreen, PrivacyRow, SettingsLink } from "./rows.js";
import { useSavedAddresses } from "./useSavedAddresses.js";

/** Between the names of saved addresses under the Addresses row. */
const LIST = ", ";

/**
 * A household's Me tab (design P7), the mirror of a worker's: who they are, then their addresses, the workers they
 * know, their QR, About me (what their agent remembers), Privacy, their language and Settings. What they paid is the
 * Pay tab's.
 */
export function HouseholdMe({ ports, account, onOpen }: { ports: Ports; account: Account; onOpen: OpenScreen }) {
  const { t } = useI18n();
  const saved = useSavedAddresses(ports);
  const places = saved?.map((a) => t(`addr.label.${a.label}`)).join(LIST);
  return (
    <>
      <MeHead account={account} saved={saved} />
      <ListCard>
        <ListRow
          icon="home"
          title={t("me.addresses")}
          sub={places || t("me.addresses_sub")}
          onClick={() => onOpen(Screen.addresses)}
        />
        <ListRow icon="people" title={t("me.people")} sub={t("me.people_sub")} onClick={() => onOpen(Screen.people)} />
        <CardRow onOpen={onOpen} />
        <ListRow
          icon="user"
          title={t("nav.about")}
          sub={t("me.about_household")}
          onClick={() => onOpen(Screen.about)}
        />
        <PrivacyRow onOpen={onOpen} />
        <LanguageRow onOpen={onOpen} />
        <SettingsLink onOpen={onOpen} />
      </ListCard>
    </>
  );
}
