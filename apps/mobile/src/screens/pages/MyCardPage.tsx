import type { Ports } from "@gigsync/core";
import type { QrCode } from "@gigsync/protocol";
import { type RefObject, useRef } from "react";
import { type Account, AccountRole } from "../../adapters/account.js";
import { publicCard } from "../../card/publish.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ScreenHead } from "../../ui/ScreenHead.js";
import { MyQr } from "../qr/MyQr.js";
import { WorkerCard } from "../qr/PersonCard.js";

interface Props {
  ports: Ports;
  account: Account;
  /** Opens Talk on the card interview. */
  onTalkCard: () => void;
  /** Opens the My card form, to review and change the card. */
  onCardForm: () => void;
  /** A GigSync QR was scanned here: open whoever it finds. */
  onScanned: (code: QrCode) => void;
}

/** Focus can land on the card, not only buttons, when "See your card as households do" brings it into view. */
const FOCUSABLE_BY_SCRIPT = -1;

/**
 * The worker's card exactly as a household sees it on the board or after scanning their QR (the same WorkerCard), or
 * why there is none, and the two ways to change it.
 */
function CardSeen({
  account,
  onTalkCard,
  onCardForm,
  at,
}: Omit<Props, "onScanned" | "ports"> & { at: RefObject<HTMLElement | null> }) {
  const { t } = useI18n();
  const card = publicCard(account);
  const made = account.worker !== undefined;
  const title = t("page.card_seen");
  return (
    <section ref={at} className={C.card} aria-label={title} tabIndex={FOCUSABLE_BY_SCRIPT}>
      <span className={C.label}>{title}</span>
      {card ? <WorkerCard card={card} /> : <span>{t(made ? "profile.card_off" : "page.card_none")}</span>}
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={onCardForm}>
          {t("shell.edit_card")}
        </button>
        <button type={C.button} className={C.secondary} onClick={onTalkCard}>
          {t(made ? "profile.talk_card" : "page.card_make")}
        </button>
      </div>
    </section>
  );
}

/**
 * My card, as collab's: the owner's QR card first (the QR beside what scanning does and its buttons), then, for a
 * worker, their public card as households see it, with Edit my card and Change by talking. A household has the QR
 * card alone; its line says what a scanning worker sees.
 */
export function MyCardPage({ ports, account, onTalkCard, onCardForm, onScanned }: Props) {
  const { t } = useI18n();
  const isWorker = account.role === AccountRole.worker;
  const seen = useRef<HTMLElement>(null);
  const seeCard = () => {
    seen.current?.scrollIntoView({ block: "start" });
    seen.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <ScreenHead head={t("nav.card")} soft={t(isWorker ? "page.card_soft_worker" : "page.card_soft")} />
      <MyQr ports={ports} account={account} onScanned={onScanned} onSeeCard={isWorker ? seeCard : undefined} />
      {isWorker && <CardSeen account={account} onTalkCard={onTalkCard} onCardForm={onCardForm} at={seen} />}
    </>
  );
}
