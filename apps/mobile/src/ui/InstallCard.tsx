import type { Lang } from "@gigsync/protocol";

/** Where the card shows: the language screen before sign-in, or Profile. */
export const InstallPlace = { onboarding: "onboarding", settings: "settings" } as const;
export type InstallPlace = (typeof InstallPlace)[keyof typeof InstallPlace];

/** Offers to put the web app on the home screen. Takes `lang` because the language screen is outside I18nProvider. */
export function InstallCard(_props: { place: InstallPlace; lang: Lang }) {
  return null;
}
