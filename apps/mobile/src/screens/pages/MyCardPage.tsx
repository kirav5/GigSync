import { type Ports, qrOwner } from "@gigsync/core";
import { type QrCode, QrRole, type WorkerRecord } from "@gigsync/protocol";
import { type Account, AccountRole } from "../../adapters/account.js";
import { publicCard } from "../../card/publish.js";
import { useOwnCard } from "../../card/useOwnCard.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ListRow } from "../../ui/ListRow.js";
import { BoardSwitch } from "../card/BoardSwitch.js";
import { MyQr } from "../qr/MyQr.js";
import { HouseholdTop, WorkerTop } from "../qr/ShareTop.js";

interface Props {
  ports: Ports;
  account: Account;
  /** When this phone last synced: the served record is read again after syncs. */
  syncedAt: Date | undefined;
  /** Opens the chat, to make or change the card by talking. */
  onTalk: () => void;
  /** Opens the My card form, until the chat can change every field on it. */
  onCardForm: () => void;
  /** A GigSync QR was scanned here: open whoever it finds. */
  onScanned: (code: QrCode) => void;
  /** The account after the board switch put the card on the board or took it off. */
  onSaved?: ((a: Account) => void) | undefined;
}

/** A worker GigSync keeps no job for yet: their card shows zeros, not nothing. */
const NO_JOBS: WorkerRecord = { jobs: 0, rated: 0 };

/**
 * My card (W6): who the owner is as others see them (for a worker, their card face and their record as GigSync keeps
 * it; for a household, the first name a scanning worker sees), then their QR to share or save, Scan a QR, and for a
 * worker, Change by talking (ADR 0053 §7) and the switch that keeps the card on the board. Edit my card, the form,
 * stays at the foot, quiet, for what the chat cannot change yet.
 */
export function MyCardPage({ ports, account, syncedAt, onTalk, onCardForm, onScanned, onSaved }: Props) {
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
      {/* The top bar says My card already; the heading stays for readers who move by headings. */}
      <h1 className="my-card-title">{t(isWorker ? "nav.card" : "profile.my_qr")}</h1>
      <MyQr
        ports={ports}
        account={account}
        label={t(isWorker ? "page.card_seen" : "qr.mine")}
        scanLine={isWorker ? t("qr.about_worker", { name: first }) : t("qr.about_household")}
        scanSub={t(isWorker ? "cardflow.scan_sub_worker" : "cardflow.scan_sub_household")}
        share={share}
        onScanned={onScanned}
        rows={
          isWorker && (
            <ListRow icon="mic" title={t("card.change_by_talking")} sub={t("cardflow.talk_sub")} onClick={onTalk} />
          )
        }
        below={isWorker && account.worker && <BoardSwitch ports={ports} account={account} onSaved={onSaved} />}
        head={!isWorker && <HouseholdTop name={first} />}
      >
        {isWorker && (
          <WorkerTop
            card={publicCard(account)}
            km={account.worker?.radius_km}
            missing={t(account.worker ? "profile.card_off" : "page.card_none")}
            record={own === undefined ? undefined : (own?.record ?? NO_JOBS)}
            hidden={own?.show_record === false}
          />
        )}
      </MyQr>
      {isWorker && (
        <div className="qr-foot">
          <button type={C.button} className={C.quiet} onClick={onCardForm}>
            {t("shell.edit_card")}
          </button>
        </div>
      )}
    </>
  );
}
