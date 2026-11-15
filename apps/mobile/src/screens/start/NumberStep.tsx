import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import type { Country } from "../../ui/countries.js";
import { Icon } from "../../ui/Icon.js";
import { InstallCard } from "../../ui/InstallCard.js";
import { typedNumber } from "../../ui/phone.js";
import { CountryButton, CountrySheet } from "./CountrySheet.js";
import { Field, FORM_ID } from "./form.js";
import { Art, StartArt } from "./StartArt.js";
import { StartBar } from "./StartBar.js";

/**
 * The number, and nothing else: the name comes after the code, once the number is known to be theirs. Under it, the
 * promise that matters most here: it reaches the other side only once both have agreed a job, and only for that job
 * (protocol job.ts ContactCard; ADR 0039 §3). On iPhone the install card comes now, before sign-in, because the
 * home-screen app keeps its own data.
 */
/** The placeholder's digit, as many as the chosen country's numbers have. */
const PLACEHOLDER = "0";

export function NumberStep({
  step,
  phone,
  onPhone,
  country,
  onCountry,
  onBack,
}: {
  /** Where this step sits in the dots at the top. */
  step: number;
  phone: string;
  onPhone: (phone: string) => void;
  /** Where the number is from: India unless the owner picks another from the flag at the field's start. */
  country: Country;
  onCountry: (country: Country) => void;
  onBack: () => void;
}) {
  const { lang, t } = useI18n();
  const field = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => field.current?.focus(), []);

  return (
    <>
      <StartBar step={step} onBack={onBack} />
      <StartArt art={Art.phone} small />
      <h1 className="start-title">{t("start.number_title")}</h1>
      <span className="start-label" id={Field.phone}>
        {t("signin.phone")}
      </span>
      <span className="start-phone">
        <CountryButton country={country} onOpen={() => setPicking(true)} />
        <input
          ref={field}
          className={C.field}
          name={Field.phone}
          required
          aria-labelledby={Field.phone}
          placeholder={typedNumber(PLACEHOLDER.repeat(country.digits[1]), country)}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={phone}
          onChange={(e) => onPhone(typedNumber(e.target.value, country))}
        />
      </span>
      {picking && (
        <CountrySheet
          country={country}
          onPick={(picked) => {
            setPicking(false);
            onCountry(picked);
            onPhone(typedNumber(phone, picked));
            field.current?.focus();
          }}
          onClose={() => setPicking(false)}
        />
      )}
      <p className="start-pill" data-tone="leaf">
        <Icon name="shield" size={16} />
        {t("start.number_why")}
      </p>
      <InstallCard lang={lang} />
    </>
  );
}

/** The number step's dock: Send code. The agreement line is on the welcome, before anything is asked. */
export function NumberActions({ busy }: { busy: boolean }) {
  const { t } = useI18n();
  return (
    <button type={C.submit} form={FORM_ID} className={`${C.wide} btn-big`} disabled={busy} aria-busy={busy}>
      {t("signin.send_code")}
    </button>
  );
}
