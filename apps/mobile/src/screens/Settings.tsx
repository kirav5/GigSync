import { log, type MessageKey, type Ports } from "@gigsync/core";
import { Lang, PAYEE_NAME_MAX } from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { PayeeError, savePayee } from "../payments/store.js";
import type { GigData } from "../state.js";
import { C } from "../ui/cls.js";
import { Look, savedLook, saveLook } from "../ui/look.js";
import { ModelSettings } from "./ModelSettings.js";
import { TranslationSettings } from "./TranslationSettings.js";

const LOOKS: readonly { look: Look; label: MessageKey }[] = [
  { look: Look.auto, label: "look.auto" },
  { look: Look.light, label: "look.light" },
  { look: Look.dark, label: "look.dark" },
];
/** UPI IDs are typed as-is: no capitals or corrections added by the phone keyboard. */
const NO_CAPS = "none";

/** The language, the worker's UPI ID and name (kept only on this device), translation, the model, and the look. */
export function Settings({ ports, data, changed }: { ports: Ports; data: GigData; changed: () => Promise<void> }) {
  const { lang, setLang, t } = useI18n();
  const [vpa, setVpa] = useState(data.payee?.vpa ?? "");
  const [name, setName] = useState(data.payee?.name ?? "");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [look, setLook] = useState<Look>(savedLook());

  // Fill the fields when the saved details arrive (the screen can open before they have loaded).
  useEffect(() => {
    setVpa(data.payee?.vpa ?? "");
    setName(data.payee?.name ?? "");
  }, [data.payee?.vpa, data.payee?.name]);

  function edit(set: (v: string) => void, value: string) {
    set(value);
    setSaved(false);
    setError(undefined);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await savePayee(ports.storage, { vpa, name });
      setError(undefined);
      setSaved(true);
      await changed();
    } catch (err) {
      setSaved(false);
      if (err instanceof PayeeError) return setError(t(err.key, err.params));
      log.warn("saving payee failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t("error.generic"));
    }
  }

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.settings")}</span>
        <h1 className={C.headline}>
          {t("settings.headline")} <span className={C.soft}>{t("settings.soft")}</span>
        </h1>
      </div>

      <div className={C.card}>
        <span className={C.label}>{t("a11y.language")}</span>
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
      </div>

      <form className={C.card} onSubmit={(e) => void onSave(e)} noValidate>
        <span className={C.label}>{t("settings.paid_to")}</span>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("settings.vpa")}</span>
          <input
            className={C.field}
            name="vpa"
            inputMode="email"
            placeholder="name@bank"
            value={vpa}
            onChange={(e) => edit(setVpa, e.target.value)}
            autoComplete={C.off}
            autoCapitalize={NO_CAPS}
            autoCorrect={C.off}
            spellCheck={false}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("settings.name")}</span>
          <input
            className={C.field}
            name="name"
            placeholder={t("signin.name")}
            maxLength={PAYEE_NAME_MAX}
            value={name}
            onChange={(e) => edit(setName, e.target.value)}
          />
        </label>
        {error && <p className={C.error}>{error}</p>}
        {saved && <span className="label fresh">{t("settings.saved")}</span>}
        <div>
          <button type="submit" className={C.btn}>
            {t("settings.save")}
          </button>
        </div>
        <span className={C.faint}>{t("settings.vpa_about")}</span>
      </form>

      <TranslationSettings />

      <ModelSettings ports={ports} />

      <div className={C.card}>
        <span className={C.label}>{t("settings.look")}</span>
        <div className={C.row}>
          {LOOKS.map((l) => (
            <button
              key={l.look}
              type={C.button}
              aria-pressed={look === l.look}
              className={look === l.look ? C.chipOn : C.chip}
              onClick={() => {
                saveLook(l.look);
                setLook(l.look);
              }}
            >
              {t(l.label)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
