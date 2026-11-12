import { type MessageKey, t as textIn } from "@gigsync/core";
import { Lang, WorkGroup } from "@gigsync/protocol";
import { type ReactNode, useId } from "react";
import { AccountRole } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize } from "../../ui/Avatar.js";
import { Brand } from "../../ui/Brand.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";

const { kn } = Lang.enum;
const G = WorkGroup.enum;
/**
 * The work named under "I do the work": the groups most asked for in the pilot, by the names Find shows (ADR 0061),
 * so the card never promises a kind of work the app does not list.
 */
const SHOWN_GROUPS: readonly WorkGroup[] = [G.house_help, G.cleaning, G.care, G.home_repairs, G.vehicles];
/** Says the list goes on. */
const AND_MORE = "…";
const ROLE_CARD = "card role-card";

/**
 * Who you are, as two big cards, the worker's first and in earth: one tap chooses and moves on to the number. Each
 * card is a radio inside the sign-in form, named by its title alone. One account has one role (adapters/account.ts),
 * so nothing here says it can be switched later.
 */
export function RoleStep({
  role,
  onRole,
  onLanguage,
}: {
  role: AccountRole | undefined;
  onRole: (role: AccountRole) => void;
  /** Back to the first screen to pick another language. */
  onLanguage: () => void;
}) {
  const { lang, t } = useI18n();
  const groups = `${SHOWN_GROUPS.map((g) => t(`group.${g}`)).join(", ")}${AND_MORE}`;
  return (
    <>
      <Brand />
      <h1 className={C.headline}>{t("start.role_title")}</h1>
      <fieldset className="role-cards" aria-label={t("a11y.role")}>
        <RoleCard
          title="signin.worker"
          about={groups}
          picture={<Avatar size={AvatarSize.xl} />}
          checked={role === AccountRole.worker}
          onPick={() => onRole(AccountRole.worker)}
          earth
        />
        <RoleCard
          title="signin.consumer"
          about={t("start.household_about")}
          picture={
            <span className="role-picture">
              <Icon name="home" size={34} />
            </span>
          }
          checked={role === AccountRole.consumer}
          onPick={() => onRole(AccountRole.consumer)}
        />
      </fieldset>
      <p className="fine">
        {t("signin.language", { lang: t(`lang.${lang}`) })} ·{" "}
        <button type={C.button} className={C.linkBtn} onClick={onLanguage}>
          {t("signin.change")}
        </button>
      </p>
    </>
  );
}

/**
 * One card: the picture, the title over its line, and the title again in Kannada, the pilot's language, for an owner
 * who reads it better than the one on screen. The radio covers the card, so a tap anywhere on it is the radio's.
 */
function RoleCard(card: {
  title: MessageKey;
  about: string;
  picture: ReactNode;
  checked: boolean;
  onPick: () => void;
  earth?: boolean;
}) {
  const { lang, t } = useI18n();
  const id = useId();
  return (
    <label className={card.earth ? `${ROLE_CARD} card-earth` : ROLE_CARD}>
      <input
        type="radio"
        name="role"
        checked={card.checked}
        readOnly
        onClick={card.onPick}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-about`}
      />
      {card.picture}
      <span className="role-words">
        <span id={`${id}-title`} className="role-title">
          {t(card.title)}
        </span>
        <span id={`${id}-about`} className="role-about">
          {card.about}
        </span>
      </span>
      {lang !== kn && (
        <span className="role-echo" lang={kn} aria-hidden="true">
          {textIn(kn, card.title)}
        </span>
      )}
    </label>
  );
}
