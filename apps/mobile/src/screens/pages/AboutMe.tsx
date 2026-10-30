import type { Ports } from "@gigsync/core";
import { Lang, PAYEE_NAME_MAX } from "@gigsync/protocol";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { PayeeForm } from "../../payments/PayeeForm.js";
import { C } from "../../ui/cls.js";
import { MemorySection } from "../memory/MemorySection.js";
import { PageFrame } from "./PageFrame.js";

/** The owner's language, picked with one tap; every screen follows it at once. */
function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  return (
    <section className={C.card} aria-label={t("profile.language")}>
      <span className={C.label}>{t("profile.language")}</span>
      <fieldset className={C.row} aria-label={t("a11y.language")}>
        {Lang.options.map((l) => (
          <button
            key={l}
            type={C.button}
            lang={l}
            aria-pressed={lang === l}
            className={lang === l ? C.chipOn : C.chip}
            onClick={() => setLang(l)}
          >
            {t(`lang.${l}`)}
          </button>
        ))}
      </fieldset>
    </section>
  );
}

/**
 * About me, as collab's: who the owner is (name and role), where a worker is paid (the UPI ID, asked for nowhere
 * else), the language, and what their agent remembers from past jobs. Each part saves as it changes, on this phone.
 */
export function AboutMe({ ports, account, isWorker }: { ports: Ports; account: Account; isWorker: boolean }) {
  const { t } = useI18n();
  const name = account.contact.name;
  return (
    <PageFrame title={t("page.about_title")} subtitle={`${name} · ${t(isWorker ? "role.worker" : "role.customer")}`}>
      {isWorker && <PayeeForm ports={ports} defaultName={name.slice(0, PAYEE_NAME_MAX)} />}
      <LanguagePicker />
      <MemorySection ports={ports} account={account} />
    </PageFrame>
  );
}
