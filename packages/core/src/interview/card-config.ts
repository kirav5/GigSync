import type { Lang, RateCard } from "@gigsync/protocol";

/** What a card interview is set up with: the owner's language, the areas to pick from and the city's rates. */

/** A pilot area by key, with every name it may be spoken or typed as, in each script and in English. */
export interface AreaChoice {
  key: string;
  names: readonly string[];
  /** The area's name in each language, for an area the app has no catalog name for (ADR 0061: kept in the directory). */
  label?: Readonly<Record<Lang, string>>;
}

export interface InterviewConfig {
  /** The owner's language: asked first among the languages, and the one questions are read in. */
  own: Lang;
  areas: readonly AreaChoice[];
  /** The city's going rates, for the amount check. */
  rates: RateCard;
}
