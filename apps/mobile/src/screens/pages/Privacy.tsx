import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { ListCard } from "../../ui/ListRow.js";
import type { GigView } from "../../useGig.js";
import { ModelSwitch } from "../privacy/ModelSwitch.js";
import { SharedLog } from "../privacy/SharedLog.js";
import { Tiers } from "../privacy/Tiers.js";
import { BlockedList } from "./BlockedList.js";
import { PageFrame } from "./PageFrame.js";
import { RecordSetting } from "./RecordSetting.js";
import { RecordsPrivacy } from "./RecordsPrivacy.js";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  /** The jobs on this phone and the names the owner knows, for the log of what the agent shared. */
  view: GigView;
  isWorker: boolean;
}

/**
 * Privacy, "Who sees what" (design P3): the three tiers in plain words, the two switches (a worker's record on their
 * card, and GigSync's model reading the chats, ADR 0052), the log of what the agent shared, the job records GigSync
 * keeps with their one delete (ADR 0038 §5), and, folded, the people the owner blocked. A worker's mentor links are on
 * Help now, with the mentors.
 */
export function Privacy({ ports, account, device, view, isWorker }: Props) {
  const { t } = useI18n();
  return (
    <PageFrame title={t("page.privacy_title")} subtitle={t("page.privacy_soft")}>
      <Tiers isWorker={isWorker} />
      <ListCard>
        {isWorker && <RecordSetting ports={ports} account={account} />}
        <ModelSwitch ports={ports} />
      </ListCard>
      <SharedLog view={view} />
      <RecordsPrivacy ports={ports} account={account} />
      <BlockedList device={device} />
    </PageFrame>
  );
}
