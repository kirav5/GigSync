import type { Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { Screen } from "../../state.js";
import { ListRow } from "../../ui/ListRow.js";
import { CardRow, type OpenScreen, PeopleRow } from "./rows.js";
import { useSavedAddresses } from "./useSavedAddresses.js";
import { workAreaName } from "./WorkAreaPage.js";

/** Between the names of saved places under their row. */
const LIST = ", ";

/**
 * A worker's rows: their card, their work area and how far they go, getting verified (said as done once this phone
 * holds a passed check), their record, and the people they know. About me and the QR are the sheet's head.
 */
export function WorkerRows({
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
    <>
      <CardRow isWorker onOpen={onOpen} />
      <ListRow
        icon="pin"
        title={t("me.work_area")}
        sub={area && km !== undefined ? t("me.area_km", { area, km }) : t("me.work_area_none")}
        onClick={() => onOpen(Screen.workArea)}
      />
      {!idChecked && <ListRow icon="shield" title={t("idcheck.title")} onClick={() => onOpen(Screen.verify)} />}
      <ListRow icon="doc" title={t("me.record")} onClick={() => onOpen(Screen.myRecord)} />
      <PeopleRow onOpen={onOpen} />
    </>
  );
}

/** A household's rows: their saved places and the people they know. About me and My QR are the sheet's head. */
export function HouseholdRows({ ports, onOpen }: { ports: Ports; onOpen: OpenScreen }) {
  const { t } = useI18n();
  const saved = useSavedAddresses(ports);
  const places = saved?.map((a) => t(`addr.label.${a.label}`)).join(LIST);
  return (
    <>
      <ListRow
        icon="home"
        title={t("me.addresses")}
        sub={places || t("me.addresses_sub")}
        onClick={() => onOpen(Screen.addresses)}
      />
      <PeopleRow onOpen={onOpen} />
    </>
  );
}
