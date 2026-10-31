import { Collection, type Ports } from "@gigsync/core";
import { DEFAULT_LANG, Lang } from "@gigsync/protocol";

/** The language this phone shows everything in, chosen on the first screen and changed in Settings. */
const LANG_KEY = "lang";

export async function loadLang(ports: Ports): Promise<Lang | undefined> {
  const saved = Lang.safeParse(await ports.storage.get<string>(Collection.settings, LANG_KEY));
  return saved.success ? saved.data : undefined;
}

export function saveLang(ports: Ports, lang: Lang): Promise<void> {
  return ports.storage.put(Collection.settings, LANG_KEY, lang);
}

/** The first of the browser's or phone's languages the app speaks, to highlight on the first screen. */
export function suggestedLang(): Lang {
  for (const tag of globalThis.navigator?.languages ?? []) {
    const known = Lang.safeParse(tag.split("-")[0]);
    if (known.success) return known.data;
  }
  return DEFAULT_LANG;
}
