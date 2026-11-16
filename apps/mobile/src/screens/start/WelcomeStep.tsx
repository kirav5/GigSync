import type { MessageKey } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import { Art, StartArt } from "./StartArt.js";

/** Stands where the link goes in the agreement line, so each language puts it where its grammar wants it. */
const LINK_SLOT = "⁣";

/** The three promises, each true of GigSync today (records.notice_never; no cut on payments). */
const POINTS: readonly { icon: IconName; text: MessageKey }[] = [
  { icon: "settings", text: "start.welcome_choose" },
  { icon: "lock", text: "start.welcome_private" },
  { icon: "heart", text: "start.welcome_direct" },
];

/**
 * The welcome after the language: the mandala straight on the page, "Let's get started", three short promises with
 * their icons, the language with its "Change", and the agreement line right above Get started, once, before anything
 * is asked (ADR 0039 §4). The block sits in the middle of the room above the dock, so a tall phone shows no empty band.
 * No back arrow: "Change" is the way back to the language screen.
 */
export function WelcomeStep({ onLanguage }: { onLanguage: () => void }) {
  const { lang, t } = useI18n();
  return (
    <div className="start-welcome">
      <StartArt art={Art.welcome} bare />
      <div className="start-head">
        <h1 className="start-title">{t("start.welcome_title")}</h1>
        <p className={C.muted}>{t("start.welcome_sub")}</p>
      </div>
      <ul className="start-points">
        {POINTS.map((p) => (
          <li key={p.text}>
            <Icon name={p.icon} size={20} />
            <span>{t(p.text)}</span>
          </li>
        ))}
      </ul>
      <p className="fine">
        {t("signin.language", { lang: t(`lang.${lang}`) })} ·{" "}
        <button type={C.button} className={C.linkBtn} onClick={onLanguage}>
          {t("signin.change")}
        </button>
      </p>
    </div>
  );
}

/** The welcome's dock: the agreement line, then Get started. */
export function WelcomeActions({ onStart, onTerms }: { onStart: () => void; onTerms: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <AgreeLine onTerms={onTerms} />
      <button type={C.button} className={`${C.wide} btn-big`} onClick={onStart}>
        {t("start.welcome_go")}
      </button>
    </>
  );
}

/** "By continuing, you agree to GigSync's Terms and Privacy Notice", the documents' name a link (ADR 0039 §4). */
function AgreeLine({ onTerms }: { onTerms: () => void }) {
  const { t } = useI18n();
  const [before, after = ""] = t("records.signin_line", { link: LINK_SLOT }).split(LINK_SLOT);
  return (
    <p className="fine start-agree">
      {before}
      <button type={C.button} className={C.linkBtn} onClick={onTerms}>
        {t("records.signin_link")}
      </button>
      {after}
    </p>
  );
}
