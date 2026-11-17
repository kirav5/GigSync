import type { Ports } from "@gigsync/core";
import { useId } from "react";
import { type Account, AccountRole } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { Screen } from "../../state.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { ListCard } from "../../ui/ListRow.js";
import { Sheet } from "../../ui/Sheet.js";
import { HouseholdRows, WorkerRows } from "./groups.js";
import { HelpRow, LanguageChip, type OpenScreen, PrivacyChip, SettingsChip } from "./rows.js";
import { useIdChecked } from "./useIdCheck.js";
import { workAreaName } from "./WorkAreaPage.js";
import "./me.css";

interface HeadProps {
  account: Account;
  idChecked: boolean;
  onOpen: OpenScreen;
}

/**
 * Who the owner is, at the top, as WhatsApp puts it: their initial, name and one line (a worker's area, or that their
 * ID was checked), the whole of it opening About me; and the QR as a square beside it, opening My card or My QR.
 */
function ProfileHead({ account, idChecked, onOpen }: HeadProps) {
  const { t } = useI18n();
  const id = useId();
  const isWorker = account.role === AccountRole.worker;
  const name = account.contact.name;
  const area = isWorker ? workAreaName(account, t) : undefined;
  const line = [area, idChecked ? t("idcheck.done") : undefined].filter(Boolean).join(" · ");
  return (
    <div className="profile-head">
      <button
        type={C.button}
        className="profile-me"
        aria-label={t("nav.about")}
        aria-describedby={id}
        onClick={() => onOpen(Screen.about)}
      >
        <Avatar name={name} size={AvatarSize.lg} tone={AvatarTone.rust} />
        <span id={id} className="profile-words">
          <span className="profile-name">{name}</span>
          {line && <span className="profile-verified">{line}</span>}
        </span>
      </button>
      <button
        type={C.button}
        className="profile-qr"
        aria-label={t("profile.my_qr")}
        onClick={() => onOpen(Screen.card)}
      >
        <Icon name="qr" size={26} />
      </button>
    </div>
  );
}

interface Props {
  ports: Ports;
  account: Account;
  /** Opens a screen above the one the owner was on, so Back comes back to it. */
  onOpen: OpenScreen;
  onClose: () => void;
}

/**
 * The profile, a tall sheet over the open screen, kept short as studies of first-time phone users ask: who the owner
 * is with their QR beside the name, then one list (a worker's card, area, check, record, people and help; a
 * household's places and people), then Language, Privacy and Settings as three small buttons at the foot. Each opens
 * a page of its own; the sheet closes first, so the screen opens with nothing over it.
 */
export function ProfileSheet({ ports, account, onOpen, onClose }: Props) {
  const { t } = useI18n();
  const isWorker = account.role === AccountRole.worker;
  const idChecked = useIdChecked(ports) && isWorker;
  const open: OpenScreen = (screen) => {
    onClose();
    onOpen(screen);
  };
  return (
    <Sheet title={t("profile.title")} done={t("profile.done")} onClose={onClose}>
      <ProfileHead account={account} idChecked={idChecked} onOpen={open} />
      <ListCard>
        {isWorker ? (
          <WorkerRows account={account} idChecked={idChecked} onOpen={open} />
        ) : (
          <HouseholdRows ports={ports} onOpen={open} />
        )}
        <HelpRow onOpen={open} />
      </ListCard>
      <div className="profile-prefs">
        <LanguageChip onOpen={open} />
        <PrivacyChip onOpen={open} />
        <SettingsChip onOpen={open} />
      </div>
    </Sheet>
  );
}
