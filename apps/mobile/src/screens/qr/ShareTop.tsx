import type { BoardProfile, WorkerRecord } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { CardFace } from "../card/CardFace.js";
import { RecordStats } from "./RecordStats.js";

interface WorkerTopProps {
  /** The card on the board, or none yet / taken off. */
  card: BoardProfile | undefined;
  /** How far the worker goes, from this phone: on their own card face only, since the board does not show it. */
  km: number | undefined;
  /** Why there is no card: none made yet, or taken off the board. */
  missing: string;
  /** The owner's own record as GigSync keeps it; undefined until this phone has read it once. */
  record: WorkerRecord | undefined;
  /** The owner chose to keep it off their card (Privacy): households do not see it. */
  hidden: boolean;
}

/**
 * The top of a worker's My card: their card face (the work they chose, their area, rates in their units, languages,
 * days and hours, and their line; ADR 0053 §7), then their record as GigSync keeps it (ADR 0036). Households see the
 * same card, with the same record unless it is hidden.
 */
export function WorkerTop({ card, km, missing, record, hidden }: WorkerTopProps) {
  const { t } = useI18n();
  return (
    <>
      {card ? <CardFace card={card} km={km} /> : <p className={`${C.card} share-missing`}>{missing}</p>}
      {record && <RecordStats record={record} />}
      {hidden && <span className={C.faint}>{t("record.card_hidden")}</span>}
    </>
  );
}

/** The top of a household's My card: the first name a scanning worker sees, and that it is a household. */
export function HouseholdTop({ name }: { name: string }) {
  const { t } = useI18n();
  return (
    <div className="share-top">
      <Avatar name={name} size={AvatarSize.xl} />
      <strong className="share-name">{name}</strong>
      <span className={C.muted}>{t("qr.household")}</span>
    </div>
  );
}
