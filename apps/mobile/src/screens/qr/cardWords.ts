import { Lang } from "@gigsync/protocol";
import type { I18n } from "../../i18n.js";

/** The language a worker writes their card in: the first one they listed that the app knows. */
export const cardLang = (card: { languages: readonly string[] }): Lang | undefined =>
  card.languages.map((l) => Lang.safeParse(l)).find((p) => p.success)?.data;

/** A card's listed languages, each named in the reader's language when the app knows it, else as its code. */
export function languageNames(codes: readonly string[], t: I18n["t"]): string {
  return codes
    .map((code) => {
      const known = Lang.safeParse(code);
      return known.success ? t(`lang.${known.data}`) : code;
    })
    .join(", ");
}
