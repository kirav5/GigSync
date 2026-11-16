import type { Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { Screen } from "../../state.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import { CardRow, type OpenScreen, PeopleRow } from "./rows.js";
import { useSavedAddresses } from "./useSavedAddresses.js";
import { workAreaName } from "./WorkAreaPage.js";

/** Between the names of saved places under their row. */
const LIST = ", ";

/**
 * A worker's first group: their card and its QR, their work area and how far they go, getting verified (said as done
 * once this phone holds a passed check), their record, About me (where the UPI ID they are paid to is kept), and the
 * people they know.
 */
export function WorkerGroup({
  account,
  idChecked,
  onOpen,
}: {
  account: Account;
  idChecked: boolean;
  onOpen: OpenScreen;
}) {
  const { t } = useI18n();
  const area = workAreaName(account, t);
  const km = account.worker?.radius_km;
  return (
    <ListCard label={t("profile.group_card")}>
      <CardRow isWorker onOpen={onOpen} />
      <ListRow
        icon="pin"
        title={t("me.work_area")}
        sub={area && km !== undefined ? t("me.area_km", { area, km }) : t("me.work_area_none")}
        onClick={() => onOpen(Screen.workArea)}
      />
      <ListRow
        icon="shield"
        title={t("idcheck.title")}
        end={idChecked ? t("idcheck.done") : undefined}
        onClick={() => onOpen(Screen.verify)}
      />
      <ListRow icon="doc" title={t("me.record")} onClick={() => onOpen(Screen.myRecord)} />
      <ListRow icon="user" title={t("nav.about")} onClick={() => onOpen(Screen.about)} />
      <PeopleRow onOpen={onOpen} />
    </ListCard>
  );
}

/** A household's first group: their saved places, the people they know, their QR, and About me. */
export function HouseholdGroup({ ports, onOpen }: { ports: Ports; onOpen: OpenScreen }) {
  const { t } = useI18n();
  const saved = useSavedAddresses(ports);
  const places = saved?.map((a) => t(`addr.label.${a.label}`)).join(LIST);
  return (
    <ListCard label={t("profile.group_home")}>
      <ListRow
        icon="home"
        title={t("me.addresses")}
        sub={places || t("me.addresses_sub")}
        onClick={() => onOpen(Screen.addresses)}
      />
      <PeopleRow onOpen={onOpen} />
      <CardRow isWorker={false} onOpen={onOpen} />
      <ListRow icon="user" title={t("nav.about")} onClick={() => onOpen(Screen.about)} />
    </ListCard>
  );
}
