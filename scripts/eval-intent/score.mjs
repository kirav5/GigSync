// Scoring: which expected slots a route filled, accuracy over groups of cases, and latency percentiles.

const PUNCTUATION = /[\p{P}\p{S}]+/gu;
const SPACES = /\s+/g;
const PERCENT = 100;
export const P50 = 0.5;
export const P95 = 0.95;

/** Text as compared: lower case, punctuation gone, single spaces. */
const plain = (s) => String(s).toLowerCase().replace(PUNCTUATION, " ").replace(SPACES, " ").trim();

/** A note matches when either text holds the other: the router may keep or drop "remember" and a few words. */
const SLOT_MATCH = {
  note: (want, got) => plain(got).length > 0 && (plain(got).includes(plain(want)) || plain(want).includes(plain(got))),
  contact: (want, got) => plain(want) === plain(got),
};
const exact = (want, got) => want === got;

/** How many of the expected slots the route filled with the expected value, out of how many were expected. */
export function slotHits(expected, actual) {
  const keys = Object.keys(expected);
  const hits = keys.filter(
    (key) => actual[key] !== undefined && (SLOT_MATCH[key] ?? exact)(expected[key], actual[key]),
  );
  return { hits: hits.length, total: keys.length, missed: keys.filter((key) => !hits.includes(key)) };
}

export const percent = (part, whole) => (whole === 0 ? undefined : (PERCENT * part) / whole);

/** Nearest-rank percentile of a list of numbers; undefined for an empty list. */
export function percentile(values, p) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

/** Intent accuracy of one router over some results. */
export function accuracy(results, router) {
  const ran = results.filter((r) => r[router]);
  return { right: ran.filter((r) => r[router].ok).length, of: ran.length };
}

/** Slot accuracy where the intent was right, and the share of all cases right in intent and every slot. */
export function slotAccuracy(results, router) {
  const ran = results.filter((r) => r[router]);
  const right = ran.filter((r) => r[router].ok);
  const hits = right.reduce((sum, r) => sum + r[router].hits, 0);
  const total = right.reduce((sum, r) => sum + r[router].total, 0);
  const whole = ran.filter((r) => r[router].ok && r[router].hits === r[router].total).length;
  return { hits, total, whole, of: ran.length };
}

/** Per slot name, in cases whose intent was right: how often it was expected and how often filled right. */
export function slotsByName(results, router) {
  const names = new Map();
  for (const r of results.filter((x) => x[router]?.ok)) {
    for (const name of Object.keys(r.case.slots ?? {})) {
      const tally = names.get(name) ?? { hits: 0, total: 0 };
      tally.total++;
      if (!r[router].missed.includes(name)) tally.hits++;
      names.set(name, tally);
    }
  }
  return names;
}

/** Results grouped by a key, in the order the keys first appear. */
export function groupBy(results, keyOf) {
  const groups = new Map();
  for (const r of results) {
    const key = keyOf(r);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return groups;
}
