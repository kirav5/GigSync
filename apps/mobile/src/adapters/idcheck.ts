import { BoundBy, type CheckedId, Collection, MAX_EKYC_ZIP_BYTES, type Storage } from "@gigsync/core";

/** The owner's settings record holding their ID check, beside their profile. */
const ID_CHECK_KEY = "id_check";
/** Today's tries at typing the number linked to the Aadhaar, beside it: a count, never a number. */
const BIND_TRIES_KEY = "id_bind_tries";
/** Numbers that do not fit the Aadhaar allowed in a day, before the check stops until tomorrow. */
export const MAX_BIND_TRIES = 3;
/**
 * Where a development build finds a test UIDAI key (base64 SPKI), so the UI tests can check files they signed; read
 * only under `import.meta.env.DEV`, so a release build trusts UIDAI's keys alone.
 */
const DEV_TEST_KEY = "gigsync.dev.uidai_spki";
const BOUND_BY: ReadonlySet<string> = new Set(Object.values(BoundBy));

/** A check that passed: the Aadhaar's few fields and how its mobile was bound to the holder, never the number itself. */
export interface BoundId extends CheckedId {
  readonly boundBy: BoundBy;
}

/**
 * The owner's Aadhaar check as this phone made it: the card's name, year of birth, gender, last 4 digits, when it was
 * checked and how its mobile was bound; never the number, address, photo or mobile (core/identity). `owned` is the
 * owner's view of the phone's storage, so another owner on the same phone never sees it. Undefined until they check,
 * and for a check made before the mobile binding: it shows no badge until they check again.
 */
export async function loadIdCheck(owned: Storage): Promise<BoundId | undefined> {
  const kept = await owned.get<Partial<BoundId> & CheckedId>(Collection.ownerSettings, ID_CHECK_KEY);
  return kept?.boundBy && BOUND_BY.has(kept.boundBy) ? { ...kept, boundBy: kept.boundBy } : undefined;
}

export function saveIdCheck(owned: Storage, id: BoundId): Promise<void> {
  return owned.put<BoundId>(Collection.ownerSettings, ID_CHECK_KEY, id);
}

export function forgetIdCheck(owned: Storage): Promise<void> {
  return owned.delete(Collection.ownerSettings, ID_CHECK_KEY);
}

interface BindTries {
  readonly day: string;
  readonly tries: number;
}

/** A locale whose dates read YYYY-MM-DD, for the local day as a plain key. */
const ISO_DAY_LOCALE = "en-CA";
/** The local day, as the tries are counted: they start again at midnight. */
const dayOf = (now: Date) => now.toLocaleDateString(ISO_DAY_LOCALE);

/** How many numbers that did not fit the Aadhaar the owner has typed today. */
export async function bindTriesToday(owned: Storage, now: Date): Promise<number> {
  const kept = await owned.get<BindTries>(Collection.ownerSettings, BIND_TRIES_KEY);
  return kept?.day === dayOf(now) ? kept.tries : 0;
}

/** Counts one more number that did not fit; returns today's count. */
export async function countBindTry(owned: Storage, now: Date): Promise<number> {
  const tries = (await bindTriesToday(owned, now)) + 1;
  await owned.put<BindTries>(Collection.ownerSettings, BIND_TRIES_KEY, { day: dayOf(now), tries });
  return tries;
}

/** A development build's test UIDAI key, when the UI tests set one; always none in a release build. */
function devIdKeys(): string[] {
  if (!import.meta.env.DEV) return [];
  try {
    const spki = globalThis.localStorage?.getItem(DEV_TEST_KEY);
    return spki ? [spki] : [];
  } catch {
    return [];
  }
}

/** What every check on this phone is given: the signed-in number to bind against, and a dev build's test key. */
export function idCheckOptions(phone: string): { readonly phone: string; readonly extraSpki: readonly string[] } {
  return { phone, extraSpki: devIdKeys() };
}

/**
 * The bytes of the Aadhaar e-KYC ZIP the person picked, or undefined when it is too big to be one (a real one is tens
 * of KB). Read here and handed straight to the check (core/identity); never stored or sent.
 */
export async function readEkycFile(file: File): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if (file.size > MAX_EKYC_ZIP_BYTES) return undefined;
  return new Uint8Array(await file.arrayBuffer());
}
