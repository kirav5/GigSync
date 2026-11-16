import type { Ports } from "@gigsync/core";
import { type Account, AccountRole } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { ListCard } from "../../ui/ListRow.js";
import { Sheet } from "../../ui/Sheet.js";
import { HouseholdGroup, WorkerGroup } from "./groups.js";
import { HelpRow, LanguageRow, type OpenScreen, PrivacyRow, SettingsLink } from "./rows.js";
import { useIdChecked } from "./useIdCheck.js";
import "./me.css";

/**
 * Who the owner is, at the top: their initial, their name and, once this phone holds a passed check, that their ID
 * was checked. It only says; About me, in the rows, opens.
 */
function ProfileHead({ name, idChecked }: { name: string; idChecked: boolean }) {
  const { t } = useI18n();
  return (
    <div className="profile-head">
      <Avatar name={name} size={AvatarSize.lg} tone={AvatarTone.rust} />
      <span className="profile-words">
        <span className="profile-name">{name}</span>
        {/* Every signed-in number was checked by its code, so that goes unsaid; only an ID check is worth a line. */}
        {idChecked && (
          <span className="profile-verified">
            <span>{t("idcheck.done")}</span>
          </span>
        )}
      </span>
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
 * The profile (design: "Profile · from the photo, top right"), a tall sheet over the open screen, grouped as the
 * phone's own settings are: who the owner is, then their card (a worker) or their home (a household), each with the
 * people they know, then updates and help, then preferences. Each row opens a page of its own, and no two open the
 * same one; the sheet closes first, so the screen opens with nothing over it. The decisions waiting are counted on
 * the Jobs tab alone.
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
      <ProfileHead name={account.contact.name} idChecked={idChecked} />
      {isWorker ? (
        <WorkerGroup account={account} idChecked={idChecked} onOpen={open} />
      ) : (
        <HouseholdGroup ports={ports} onOpen={open} />
      )}
      {isWorker && (
        <ListCard label={t("profile.group_help")}>
          <HelpRow onOpen={open} />
        </ListCard>
      )}
      <ListCard label={t("profile.group_prefs")}>
        <LanguageRow onOpen={open} />
        <PrivacyRow onOpen={open} />
        <SettingsLink onOpen={open} />
      </ListCard>
    </Sheet>
  );
}
