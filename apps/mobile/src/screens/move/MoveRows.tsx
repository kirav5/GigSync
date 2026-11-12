import { useI18n } from "../../i18n.js";
import { ListRow } from "../../ui/ListRow.js";

/** Settings' two ways of moving between phones (ADR 0037), as rows of This phone: show this phone's code, or scan one. */
export function MoveRows({ onMoveOut, onMoveIn }: { onMoveOut: () => void; onMoveIn: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <ListRow icon="move" title={t("phone.move_out")} sub={t("phone.move_out_about")} onClick={onMoveOut} />
      <ListRow icon="qr" title={t("phone.move_in")} sub={t("phone.move_in_about")} onClick={onMoveIn} />
    </>
  );
}
