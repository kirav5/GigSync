import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { COUNTRIES, type Country, countryName, flag } from "../../ui/countries.js";
import { Icon } from "../../ui/Icon.js";
import { Sheet } from "../../ui/Sheet.js";

/** The country-code button at the start of the number field: the flag and "+91", opening the list. */
export function CountryButton({ country, onOpen }: { country: Country; onOpen: () => void }) {
  const { lang, t } = useI18n();
  return (
    <button
      type={C.button}
      className="start-cc"
      aria-label={t("start.country", { country: countryName(country.iso, lang), dial: country.dial })}
      onClick={onOpen}
    >
      <span className="start-flag" aria-hidden="true">
        {flag(country.iso)}
      </span>
      +{country.dial}
      <Icon name="chev_down" size={16} />
    </button>
  );
}

/** The countries a number may come from, as a tall sheet: flag, name and code, the chosen one ticked. */
export function CountrySheet({
  country,
  onPick,
  onClose,
}: {
  country: Country;
  onPick: (country: Country) => void;
  onClose: () => void;
}) {
  const { lang, t } = useI18n();
  return (
    <Sheet title={t("start.country_title")} done={t("progress.done")} onClose={onClose}>
      <ul className="country-list">
        {COUNTRIES.map((c) => (
          <li key={c.iso}>
            <button
              type={C.button}
              className="country-row"
              aria-pressed={c.iso === country.iso}
              onClick={() => onPick(c)}
            >
              <span className="start-flag" aria-hidden="true">
                {flag(c.iso)}
              </span>
              <span className="country-name">{countryName(c.iso, lang)}</span>
              <span className="country-dial">+{c.dial}</span>
              {c.iso === country.iso && <Icon name="check" size={20} />}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
