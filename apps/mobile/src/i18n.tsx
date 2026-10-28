import {
  dateText,
  type MessageKey,
  type Params,
  type PluralKey,
  plural,
  type Translations,
  t,
  timeText,
} from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import { translations } from "./adapters/translate.js";

/** Everything a screen needs to speak the owner's language, bound to it once. */
export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, params?: Params) => string;
  plural: (key: PluralKey, count: number, params?: Params) => string;
  time: (at: Date) => string;
  date: (at: Date) => string;
  /** Free text from other people, translated on this phone. */
  translations: Translations;
}

const I18nContext = createContext<I18n | undefined>(undefined);

export function I18nProvider({
  lang,
  setLang,
  children,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  children: ReactNode;
}) {
  // Screen readers, fonts and line breaking follow the page's language.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, params) => t(lang, key, params),
      plural: (key, count, params) => plural(lang, key, count, params),
      time: (at) => timeText(lang, at),
      date: (at) => dateText(lang, at),
      translations,
    }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error("useI18n outside I18nProvider");
  return i18n;
}
