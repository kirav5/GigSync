import { type MessageKey, t as textIn } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { useId } from "react";
import { AccountRole } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { Art, artSrc } from "./StartArt.js";
import { StartBar } from "./StartBar.js";
import "./role.css";

const { kn } = Lang.enum;
/**
 * Find work or find help: the question, one short line, and the two choices under it as one block in the top part of
 * the screen. Each choice is a tall card with its drawing filling the top and the title and its line below. The whole
 * card is the choice: picked, its edge turns terracotta and a tick sits on its corner; one tap picks and the name
 * comes next. Asked after the code, and only
 * for a number this phone keeps nothing for: a returning number keeps the side it had. No way back, as the code is
 * already used. Each card is a radio inside the sign-in form, named by its title alone. One account has one side
 * (adapters/account.ts), so nothing here says it can be switched later.
 */
export function RoleStep({
  step,
  role,
  onRole,
}: {
  /** Where this step sits in the dots at the top. */
  step: number;
  role: AccountRole | undefined;
  onRole: (role: AccountRole) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <StartBar step={step} />
      <div className="start-head">
        <h1 className="start-title">{t("start.role_title")}</h1>
        <p className="role-sub">{t("start.role_sub")}</p>
      </div>
      <fieldset className="role-cards" aria-label={t("a11y.role")}>
        <RoleCard
          title="signin.worker"
          line="start.role_work_line"
          art={Art.roleWork}
          checked={role === AccountRole.worker}
          onPick={() => onRole(AccountRole.worker)}
        />
        <RoleCard
          title="signin.consumer"
          line="start.role_help_line"
          art={Art.roleHelp}
          checked={role === AccountRole.consumer}
          onPick={() => onRole(AccountRole.consumer)}
        />
      </fieldset>
    </>
  );
}

/**
 * One card: the drawing as a wide tile across its top, then the title with the same title in Kannada, the pilot's
 * language, beside it for an owner who reads it better than the one on screen, and the line under them. The radio
 * covers the card, so a tap anywhere on it is the radio's.
 */
function RoleCard(card: { title: MessageKey; line: MessageKey; art: Art; checked: boolean; onPick: () => void }) {
  const { lang, t } = useI18n();
  const id = useId();
  return (
    <label className="role-card">
      <input
        type="radio"
        name="role"
        checked={card.checked}
        readOnly
        onClick={card.onPick}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-line`}
      />
      <span className="role-picture">
        <img src={artSrc(card.art)} alt="" decoding="async" />
      </span>
      <span className="role-words">
        <span className="role-name">
          <span id={`${id}-title`} className="role-title">
            {t(card.title)}
          </span>
          {lang !== kn && (
            <span className="role-echo" lang={kn} aria-hidden="true">
              {textIn(kn, card.title)}
            </span>
          )}
        </span>
        <span id={`${id}-line`} className="role-line">
          {t(card.line)}
        </span>
      </span>
      <span className="role-mark" aria-hidden="true" />
    </label>
  );
}
