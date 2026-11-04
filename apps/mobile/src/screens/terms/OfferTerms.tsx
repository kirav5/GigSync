import { termText } from "@gigsync/core";
import { TermKey, type Terms } from "@gigsync/protocol";
import { Fragment } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** Between two terms, as the joined list reads them. */
const LIST = ", ";
/** Where the list goes in "Terms: {terms}", so each term can carry its own mark. */
const SLOT = "\u0000";

/**
 * What one side proposed besides the price, on one line under its offer in the agents' conversation (ADR 0053 §6). A
 * term that differs from the other side's last proposal is marked, in words as well as weight. Nothing without terms.
 */
export function OfferTerms({ terms, changed = [] }: { terms: Terms | undefined; changed?: readonly TermKey[] }) {
  const { lang, t } = useI18n();
  const items = TermKey.options.flatMap((key) => {
    const value = terms && termText(lang, key, terms);
    return value ? [{ key, value, changed: changed.includes(key) }] : [];
  });
  if (items.length === 0) return null;
  const [before = "", after = ""] = t("terms.proposed", { terms: SLOT }).split(SLOT);
  return (
    <span className="offer-terms">
      {before}
      {items.map((item, i) => (
        <Fragment key={item.key}>
          {i > 0 && LIST}
          <span data-term={item.key} data-changed={item.changed ? true : undefined}>
            {item.value}
            {item.changed && <span className={C.faint}> {t("talk.term_changed")}</span>}
          </span>
        </Fragment>
      ))}
      {after}
    </span>
  );
}
