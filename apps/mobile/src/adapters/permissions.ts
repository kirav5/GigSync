import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/** The phone permissions GigSync explains in its own words before the phone asks for them. */
export const Permission = { mic: "mic" } as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const KEY_PREFIX = "permission-explained-";
const EXPLAINED = "yes";

/**
 * True the first time a native phone is about to ask for `p`. The phone's own prompt is in the phone's language,
 * which may not be the app's, so the app says why first (round2-spec §1.4). The web's prompt needs no preface.
 */
export async function needsExplaining(p: Permission): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { value } = await Preferences.get({ key: `${KEY_PREFIX}${p}` });
  return value !== EXPLAINED;
}

export async function markExplained(p: Permission): Promise<void> {
  await Preferences.set({ key: `${KEY_PREFIX}${p}`, value: EXPLAINED });
}
