import { InstallState, install, installOffered, useInstallState } from "../../adapters/install.js";
import { useI18n } from "../../i18n.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import { MoveRows } from "../move/MoveRows.js";

interface Props {
  /** Opens the Install screen's steps, where the browser has no install prompt of its own to show. */
  onInstall: () => void;
  onMoveOut: () => void;
  onMoveIn: () => void;
  /** Opens the Terms and Privacy Notice. */
  onTerms: () => void;
  onSignOut: () => void;
}

/**
 * Settings' "This phone" (design P4): moving to a new phone or from an old one (ADR 0037), Install app until GigSync is
 * on the home screen (the browser's own prompt where there is one, else the Install screen's steps), the Terms and
 * Privacy Notice (ADR 0039 §4), and Sign out, which leaves the owner's records on the phone (ADR 0032).
 */
export function ThisPhone({ onInstall, onMoveOut, onMoveIn, onTerms, onSignOut }: Props) {
  const { t } = useI18n();
  const state = useInstallState();
  const installApp = () => {
    if (state === InstallState.prompt) void install();
    else onInstall();
  };
  return (
    <ListCard label={t("me.this_phone")}>
      <MoveRows onMoveOut={onMoveOut} onMoveIn={onMoveIn} />
      {installOffered(state) && (
        <ListRow icon="install" title={t("install.button")} sub={t("install.about")} onClick={installApp} />
      )}
      <ListRow icon="doc" title={t("records.terms_title")} sub={t("records.terms_about")} onClick={onTerms} />
      <ListRow icon="close" title={t("shell.sign_out")} sub={t("me.sign_out_sub")} onClick={onSignOut} />
    </ListCard>
  );
}
