import type { SavedAddress } from "@gigsync/protocol";
import { type Account, AccountRole } from "../../adapters/account.js";
import { publicCard } from "../../card/publish.js";
import { type I18n, useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { Badge, BadgeTone } from "../../ui/Badge.js";
import { cardWork } from "../../ui/work.js";
import "./me.css";

/** Between the parts of the line under the name, and between languages. */
const PARTS = " · ";
const LIST = ", ";

/** A worker's line: their work, their area, the languages they speak, as their card says them. */
function workerLine(t: I18n["t"], account: Account): string {
  const rules = account.worker;
  const work = rules ? cardWork(t, rules) : "";
  const area = publicCard(account)?.area_name ?? rules?.base_name ?? "";
  const langs = (account.languages ?? []).map((l) => t(`lang.${l}`)).join(LIST);
  return [work, area, langs].filter(Boolean).join(PARTS);
}

/** A household's line: the area of their first saved address, and the language they use GigSync in. */
function householdLine(language: string, saved: readonly SavedAddress[] | undefined): string {
  return [saved?.[0]?.area ?? "", language].filter(Boolean).join(PARTS);
}

interface Props {
  account: Account;
  /** A household's saved addresses: a pinned door earns its badge. */
  saved: readonly SavedAddress[] | undefined;
}

/**
 * Who the owner is, at the top of Me: a worker on the dark earth card the design gives them, a household on a light
 * one. Badges say only what GigSync knows: the phone number was checked by a code at sign-in, a door was pinned on the
 * map (households), and whether a worker's card is on the board. No photo and no ID badge: neither exists.
 */
export function MeHead({ account, saved }: Props) {
  const { t, lang } = useI18n();
  const isWorker = account.role === AccountRole.worker;
  const name = account.contact.name;
  const line = isWorker ? workerLine(t, account) : householdLine(t(`lang.${lang}`), saved);
  const pinned = saved?.some((a) => a.pinned === true) === true;
  const listed = account.listed !== false;
  return (
    <section className={isWorker ? "me-head earth" : "me-head"} aria-label={name}>
      <div className="me-who">
        <Avatar name={name} size={AvatarSize.lg} tone={isWorker ? AvatarTone.earth : AvatarTone.rust} />
        <div className="me-words">
          <h1 className="me-name">{name}</h1>
          {line && <p className="me-line">{line}</p>}
        </div>
      </div>
      <ul className="me-badges" aria-label={t("me.badges")}>
        <li>
          <Badge icon="check" tone={BadgeTone.green}>
            {t("me.phone")}
          </Badge>
        </li>
        {pinned && (
          <li>
            <Badge icon="pin" tone={BadgeTone.green}>
              {t("me.door_pin")}
            </Badge>
          </li>
        )}
        {isWorker && account.worker && (
          <li>
            <Badge tone={listed ? BadgeTone.green : BadgeTone.muted}>
              {t(listed ? "me.on_board" : "me.off_board")}
            </Badge>
          </li>
        )}
      </ul>
    </section>
  );
}
