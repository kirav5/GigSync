// The eval set (vectors/intents/<set>/<group>.json): read, checked with zod and by the rules a schema cannot say,
// and turned into cases with the context each router takes. A broken file throws `DataError`.
import { readdirSync, readFileSync } from "node:fs";
import { core, FIELDS, protocol, z } from "./core.mjs";

const VECTORS = new URL("../../vectors/intents/", import.meta.url);
const JSON_FILE = /\.json$/;

/**
 * Each set of phrasings and the app language its owners chose; Hinglish is Hindi typed in Latin letters, Kanglish
 * Kannada typed in Latin letters (the kn set also has a few from before Kanglish had its own set).
 */
const L = protocol.Lang.enum;
export const SETS = { en: L.en, hi: L.hi, kn: L.kn, hinglish: L.hi, kanglish: L.kn };

/** Whether today's word lists get a case right ("list") or it was written to probe what they miss ("miss"). */
const Source = { list: "list", miss: "miss" };

const MAX_TEXT = 300;
const MAX_CONTACTS = 20;
const AREA_KEYS = core.PILOT_AREAS.map((area) => area.key);

const Slots = z.strictObject({
  trade: z.enum(protocol.Trade.options).optional(),
  area: z.enum(AREA_KEYS).optional(),
  city: z.enum(protocol.City.options).optional(),
  amount_paise: z.number().int().positive().optional(),
  contact: z.string().min(1).optional(),
  field: z.enum(FIELDS).optional(),
  note: z.string().min(1).optional(),
});

const Case = z.strictObject({
  id: z.string().regex(/^[a-z]+-[A-Za-z]+-\d{2}$/),
  lang: z.enum(protocol.Lang.options),
  role: z.enum(Object.values(core.ChatRole)),
  text: z.string().min(1).max(MAX_TEXT),
  contacts: z.array(z.string().min(1)).max(MAX_CONTACTS).optional(),
  trades: z.array(z.enum(protocol.Trade.options)).min(1).optional(),
  inMove: z.boolean().optional(),
  intent: z.enum(Object.values(core.ChatIntent)),
  slots: Slots.optional(),
  source: z.enum(Object.values(Source)),
});

const File = z.strictObject({ cases: z.array(Case).min(1) });

export class DataError extends Error {}

/**
 * Two fixed halves of the eval set: `dev`, about a third, to look at while changing the prompt; `test`, the rest, to
 * score the change on. A case's half comes from its id alone, so it never moves when cases are added.
 */
export const Split = { dev: "dev", test: "test" };
const DEV_SHARE = 3;
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

/** FNV-1a of the id, so the split is the same on every machine. */
function idHash(id) {
  let hash = FNV_OFFSET;
  for (const char of id) hash = Math.imul(hash ^ char.codePointAt(0), FNV_PRIME) >>> 0;
  return hash;
}

export const splitOf = (id) => (idHash(id) % DEV_SHARE === 0 ? Split.dev : Split.test);

/** The context a router takes for one case: what the chat knows besides the words. */
export const contextOf = (c) => ({
  lang: c.lang,
  role: c.role,
  contacts: c.contacts ?? [],
  ...(c.trades ? { trades: c.trades } : {}),
  ...(c.inMove ? { inMove: true } : {}),
});

/** The rules across fields: where a case lives, what its owner can ask, and slots core could accept. */
function problemsOf(c, set) {
  const problems = [];
  if (!c.id.startsWith(`${set}-`)) problems.push(`id should start with "${set}-"`);
  if (c.lang !== SETS[set]) problems.push(`lang should be "${SETS[set]}" in the ${set} set`);
  if (!core.intentAllowed(c.intent, contextOf(c))) problems.push(`a ${c.role} cannot ask "${c.intent}" here`);
  if (c.slots?.contact && !(c.contacts ?? []).includes(c.slots.contact)) problems.push("contact is not in contacts");
  return problems;
}

/** One file's cases, each with its set and file; throws on anything the schema or the rules reject. */
function readFile(set, name) {
  const where = `vectors/intents/${set}/${name}`;
  let raw;
  try {
    raw = JSON.parse(readFileSync(new URL(`${set}/${name}`, VECTORS), "utf8"));
  } catch (error) {
    throw new DataError(`${where}: not readable JSON (${error.message})`);
  }
  const parsed = File.safeParse(raw);
  if (!parsed.success) throw new DataError(`${where}: ${z.prettifyError(parsed.error)}`);
  const problems = parsed.data.cases.flatMap((c) => problemsOf(c, set).map((p) => `${c.id}: ${p}`));
  if (problems.length > 0) throw new DataError(`${where}:\n  ${problems.join("\n  ")}`);
  return parsed.data.cases.map((c) => ({ ...c, set, file: name }));
}

/** Every case in every set, checked; ids are unique across the whole eval set. */
export function loadCases() {
  const cases = Object.keys(SETS).flatMap((set) =>
    readdirSync(new URL(`${set}/`, VECTORS))
      .filter((name) => JSON_FILE.test(name))
      .sort()
      .flatMap((name) => readFile(set, name)),
  );
  const seen = new Set();
  for (const c of cases) {
    if (seen.has(c.id)) throw new DataError(`duplicate case id ${c.id}`);
    seen.add(c.id);
  }
  return cases;
}
