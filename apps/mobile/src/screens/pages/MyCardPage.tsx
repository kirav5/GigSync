import { type Ports, qrOwner } from "@gigsync/core";
import { type QrCode, QrRole, type WorkerRecord } from "@gigsync/protocol";
import { type Account, AccountRole } from "../../adapters/account.js";
import { publicCard } from "../../card/publish.js";
import { useOwnCard } from "../../card/useOwnCard.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ScreenHead } from "../../ui/ScreenHead.js";
import { MyQr } from "../qr/MyQr.js";
import { HouseholdTop, WorkerTop } from "../qr/ShareTop.js";

interface Props {
  ports: Ports;
  account: Account;
  /** When this phone last synced: the served record is read again after syncs. */
  syncedAt: Date | undefined;
  /** Opens the My card form, to make or change the card. */
  onCardForm: () => void;
  /** A GigSync QR was scanned here: open whoever it finds. */
  onScanned: (code: QrCode) => void;
}

/** A worker GigSync keeps no job for yet: their card shows zeros, not nothing. */
const NO_JOBS: WorkerRecord = { jobs: 0, rated: 0, came_back: 0 };

/**
 * My card, as collab's: one card, centred, with who the owner is as others see them (for a worker, their card and
 * their record as GigSync keeps it; for a household, the first name a scanning worker sees), their QR and its
 * buttons. A worker changes their card with the one Edit my card; changing it by talking stays in the chat.
 */
export function MyCardPage({ ports, account, syncedAt, onCardForm, onScanned }: Props) {
  const { t } = useI18n();
  const isWorker = account.role === AccountRole.worker;
  const first = qrOwner(account.contact.name, isWorker ? QrRole.enum.worker : QrRole.enum.household).first_name;
  const own = useOwnCard(ports, account, syncedAt).card;
  const share = {
    title: t("qr.share_title", { name: first }),
    text: t(isWorker ? "qr.share_worker" : "qr.share_household", { name: first }),
  };
  return (
    <>
      {/* Said under the head, not as its second half: that half is hidden on a phone, where the card is shown. */}
      <ScreenHead head={t("nav.card")}>
        <p className={C.muted}>{t(isWorker ? "page.card_soft_worker" : "page.card_soft")}</p>
      </ScreenHead>
      <MyQr
        ports={ports}
        account={account}
        label={t(isWorker ? "page.card_seen" : "qr.mine")}
        scanLine={isWorker ? t("qr.about_worker", { name: first }) : t("qr.about_household")}
        share={share}
        onScanned={onScanned}
      >
        {isWorker ? (
          <WorkerTop
            name={account.contact.name}
            card={publicCard(account)}
            missing={t(account.worker ? "profile.card_off" : "page.card_none")}
            record={own === undefined ? undefined : (own?.record ?? NO_JOBS)}
            hidden={own?.show_record === false}
          />
        ) : (
          <HouseholdTop name={first} />
        )}
      </MyQr>
      {isWorker && (
        <div className={C.actions}>
          <button type={C.button} className={C.accent} onClick={onCardForm}>
            {t("shell.edit_card")}
          </button>
        </div>
      )}
    </>
  );
}
