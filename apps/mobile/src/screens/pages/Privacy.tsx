import type { GigDevice, Ports } from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { LinksSection } from "../mentor/LinksSection.js";
import { BlockedList } from "./BlockedList.js";
import { PageFrame } from "./PageFrame.js";
import { RecordSetting } from "./RecordSetting.js";
import { RecordsPrivacy } from "./RecordsPrivacy.js";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  isWorker: boolean;
  /** Opens one mentor link's thread, where its person can be blocked. */
  onOpenLink: (user: UserId) => void;
}

/**
 * Privacy, as collab's: whether a worker's record shows on their card, the job records GigSync keeps and deleting
 * them, a worker's live mentor links, and the people the owner blocked.
 */
export function Privacy({ ports, account, device, isWorker, onOpenLink }: Props) {
  const { t } = useI18n();
  return (
    <PageFrame title={t("page.privacy_title")} subtitle={t("page.privacy_soft")}>
      {isWorker && <RecordSetting ports={ports} account={account} />}
      <RecordsPrivacy ports={ports} account={account} />
      {isWorker && <LinksSection onOpen={onOpenLink} />}
      <BlockedList device={device} />
    </PageFrame>
  );
}
