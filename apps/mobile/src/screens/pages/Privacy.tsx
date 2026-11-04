import type { GigDevice, Ports } from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
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

/** Who reads what the owner writes to their agent (ADR 0052), and how to keep it all on the phone. */
function ModelPrivacy() {
  const { t } = useI18n();
  const title = t("page.privacy_model_title");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <span className={C.muted}>{t("page.privacy_model_about")}</span>
    </section>
  );
}

/**
 * Privacy, as collab's: who reads what the owner writes, whether a worker's record shows on their card, the job
 * records GigSync keeps and deleting them, a worker's live mentor links, and the people the owner blocked.
 */
export function Privacy({ ports, account, device, isWorker, onOpenLink }: Props) {
  const { t } = useI18n();
  return (
    <PageFrame title={t("page.privacy_title")} subtitle={t("page.privacy_soft")}>
      <ModelPrivacy />
      {isWorker && <RecordSetting ports={ports} account={account} />}
      <RecordsPrivacy ports={ports} account={account} />
      {isWorker && <LinksSection onOpen={onOpenLink} />}
      <BlockedList device={device} />
    </PageFrame>
  );
}
