import {
  aboutIsPrivate,
  arrangementMandates,
  arrangementRates,
  atShare,
  type CardDraft,
  CITY_RATES,
  cardWorks,
  localitySlug,
  type Mandate,
  mainOf,
  nearestPilotArea,
  type OwnCard,
  type Ports,
  publicWorkRates,
  refreshOwnCard,
  type TermPrefs,
  type WorkerRules,
  type WorkMandate,
  workHoursOf,
} from "@gigsync/core";
import { type BoardProfile, coarsePoint, type Lang, type WorkHours } from "@gigsync/protocol";
import { type Account, apiClient, saveAccount } from "../adapters/account.js";
import { recordsClient } from "../adapters/records.js";
import { AREAS } from "../ui/places.js";

/** How far a worker goes from their area's centre until the card lets them say. */
export const DEFAULT_RADIUS_KM = 10;

/** A draft missing what the board needs; the interview and the form check before this, so it is a bug if seen. */
class CardIncompleteError extends Error {}

/**
 * The line about the work holds a phone number or a UPI ID. The board is public, so it would hand out contact before
 * both sides sign; the owner is told to leave it out (`iv.err_private`).
 */
export class AboutPrivateError extends Error {}

/** How far the worker goes, in km: as the draft says, else as the card on this phone does, else the default. */
export const radiusOf = (account: Account, draft: CardDraft): number =>
  draft.radius_km ?? account.worker?.radius_km ?? DEFAULT_RADIUS_KM;

/** The owner's own language first: it is the one their card's free text is written in. */
const spokenOf = (draft: CardDraft, lang: Lang): Lang[] => [lang, ...(draft.languages ?? []).filter((l) => l !== lang)];

/**
 * The card a draft puts on the board, as the board will show it: what is published, and what the owner sees read back
 * before saying yes. Undefined while the draft lacks something the board needs.
 */
export function draftCard(account: Account, draft: CardDraft, lang: Lang): BoardProfile | undefined {
  const { trades = [], skills = [], rate_paise: rate, limit_paise: limit } = draft;
  const area = baseOf(draft);
  if (trades.length + skills.length === 0 || !area || rate === undefined || limit === undefined || limit > rate)
    return undefined;
  const rates = arrangementRates(draft);
  const workRates = workMandates(draft, { opening_paise: rate, limit_paise: limit });
  return {
    display_name: account.contact.name,
    trades,
    ...(skills.length > 0 ? { skills } : {}),
    area: coarsePoint(area),
    area_name: area.name,
    rate_paise: rate,
    languages: spokenOf(draft, lang),
    about: draft.about?.trim() ?? "",
    ...(rates.length > 0 ? { arrangements: rates } : {}),
    ...(workRates.length > 0 ? { work_rates: publicWorkRates(workRates) } : {}),
    ...withHours(draft.terms ?? account.worker?.terms),
  };
}

/**
 * Puts the card on the board and keeps the private half on this phone, for the interview and the My card form alike.
 * The public card is what the board shows; the rules (lowest rate, what to see first) never leave the phone. The UPI
 * ID is not part of either: payment requests read it from About me at send time.
 */
export async function publishCard(ports: Ports, account: Account, draft: CardDraft, lang: Lang): Promise<Account> {
  const card = draftCard(account, draft, lang);
  const area = baseOf(draft);
  const { rate_paise: rate, limit_paise: limit } = draft;
  if (!card || !area || rate === undefined || limit === undefined)
    throw new CardIncompleteError("card draft is incomplete");
  // Checked here, where the interview and the My card form meet, so neither path can put contact on the board.
  if (aboutIsPrivate(card.about)) throw new AboutPrivateError("the line about the work holds contact details");
  const mandate = { opening_paise: rate, limit_paise: limit };
  const main = mainOf(draft);
  const rates = arrangementRates(draft);
  const workRates = workMandates(draft, mandate);
  const worker: WorkerRules = {
    trades: card.trades,
    ...(card.skills ? { skills: card.skills } : {}),
    rate: mandate,
    // The agent's own copy stays on the phone as the worker set it; the board keeps the coarse one.
    base: { lat: area.lat, lon: area.lon },
    ...(draft.place ? { base_name: draft.place.name } : {}),
    radius_km: radiusOf(account, draft),
    ...(main && rates.length > 0 ? { arrangements: arrangementMandates(rates, mandate, main) } : {}),
    ...(workRates.length > 0 ? { work_rates: workRates } : {}),
    rates: CITY_RATES,
    ask_me: draft.ask_me ?? [],
    // ADR 0063: what the agent's questions are written from, on this phone only.
    ...(card.about ? { about: card.about } : {}),
    ...(draft.asks?.length ? { asks: draft.asks } : {}),
    ...withPrefs(draft.terms ?? account.worker?.terms),
  };
  // No record and no "show my record": the server computes the one and keeps the other as the worker last set it.
  await apiClient(account.session).publishProfile(card);
  const next: Account = {
    ...account,
    worker,
    languages: spokenOf(draft, lang),
    autoConfirm: draft.auto ?? false,
    about: card.about,
    listed: true,
  };
  await saveAccount(ports, next);
  return next;
}

/** Takes the card off the board, for the interview and the My card form alike; the card stays on this phone. */
export async function unlistCard(ports: Ports, account: Account): Promise<Account> {
  await apiClient(account.session).removeProfile();
  const next: Account = { ...account, listed: false };
  await saveAccount(ports, next);
  return next;
}

/**
 * Where the card says the worker works from: the place they found with their location, at its own point, whenever
 * there is one (even when its name matches a pilot area's, whose centre can be kilometres off); else a pilot area's
 * centre, picked from the list.
 */
function baseOf(draft: CardDraft): { name: string; lat: number; lon: number } | undefined {
  if (draft.place && draft.area) return draft.place;
  return AREAS.find((a) => a.key === draft.area);
}

/**
 * The plans for the kinds with a rate of their own (ADR 0062): each kind on the card besides the first that the worker
 * priced apart, with its lowest as they set it, else at the share of the card's.
 */
function workMandates(draft: CardDraft, main: Mandate): WorkMandate[] {
  if (draft.same_rate !== false) return [];
  return cardWorks(draft)
    .slice(1)
    .flatMap((work) => {
      const usual = draft.work_rates?.[work];
      if (usual === undefined) return [];
      const lowest = draft.work_limits?.[work];
      const rate =
        lowest !== undefined && lowest <= usual ? { opening_paise: usual, limit_paise: lowest } : atShare(usual, main);
      return [{ work, rate }];
    });
}

/** The kinds' own rates back as a draft's. */
function workDraft(rules: WorkerRules): Pick<CardDraft, "same_rate" | "work_rates" | "work_limits"> {
  if (!rules.work_rates?.length) return {};
  return {
    same_rate: false,
    work_rates: Object.fromEntries(rules.work_rates.map((w) => [w.work, w.rate.opening_paise])),
    work_limits: Object.fromEntries(rules.work_rates.map((w) => [w.work, w.rate.limit_paise])),
  };
}

/** The card's arrangements and their rates back as a draft's: the main one's is the usual rate. */
function arrangementDraft(rules: WorkerRules): Pick<CardDraft, "arrangements" | "other_rates"> {
  if (!rules.arrangements?.length) return {};
  const arrangements = rules.arrangements.map((a) => a.arrangement);
  const other_rates = Object.fromEntries(rules.arrangements.map((a) => [a.arrangement, a.rate.opening_paise]));
  return { arrangements, other_rates };
}

/** The card this phone holds now, as a draft: where the interview starts from and the form's defaults. */
export function accountDraft(account: Account): CardDraft {
  const rules = account.worker;
  if (!rules) return {};
  const pilot = rules.base_name ? undefined : nearestPilotArea(rules.base);
  const place = !pilot && rules.base_name ? { name: rules.base_name, ...rules.base } : undefined;
  const custom = place && localitySlug(place.name);
  return {
    trades: rules.trades,
    ...(rules.skills?.length ? { skills: rules.skills } : {}),
    ...(pilot ? { area: pilot.key } : {}),
    ...(place && custom ? { area: custom, place } : {}),
    radius_km: rules.radius_km,
    ...arrangementDraft(rules),
    ...workDraft(rules),
    rate_paise: rules.rate.opening_paise,
    limit_paise: rules.rate.limit_paise,
    ...(account.languages ? { languages: account.languages } : {}),
    ...(account.about ? { about: account.about } : {}),
    ask_me: rules.ask_me ?? [],
    ...(rules.asks?.length ? { asks: rules.asks } : {}),
    auto: account.autoConfirm ?? false,
    ...withPrefs(rules.terms),
  };
}

/** `{ terms }` when the worker set any preference for terms besides the price. */
const withPrefs = (terms: TermPrefs | undefined): { terms?: TermPrefs } => (terms ? { terms } : {});

/**
 * The card the board shows for this worker, as this phone holds it: what an offer to work carries. Undefined before
 * they make a card or while it is off the board.
 */
export function publicCard(account: Account): BoardProfile | undefined {
  const rules = account.worker;
  if (!rules || account.listed === false) return undefined;
  // Its own name, never another area's (ADR 0045): a pilot area near the base, else the name the worker's phone found.
  const name = rules.base_name ?? nearestPilotArea(rules.base)?.name;
  if (!name) return undefined;
  const rates = rules.arrangements?.map((a) => ({ arrangement: a.arrangement, rate_paise: a.rate.opening_paise }));
  return {
    display_name: account.contact.name,
    trades: rules.trades,
    ...(rules.skills?.length ? { skills: rules.skills } : {}),
    area: coarsePoint(rules.base),
    area_name: name,
    ...(rates?.length ? { arrangements: rates } : {}),
    rate_paise: rules.rate.opening_paise,
    ...(rules.work_rates?.length ? { work_rates: publicWorkRates(rules.work_rates) } : {}),
    languages: account.languages ?? [],
    about: account.about ?? "",
    ...withHours(rules.terms),
  };
}

/** `{ work_hours }` when the worker said which days or parts of the day they work (ADR 0050 §2). */
function withHours(terms: TermPrefs | undefined): { work_hours?: WorkHours } {
  const hours = workHoursOf(terms);
  return hours ? { work_hours: hours } : {};
}

/** "Show my record on my card" needs a card on the board to change: the switch is set by publishing the card with it. */
export class NoCardError extends Error {}

/**
 * Privacy's "Show my record on my card" (ADR 0036 §3): the card goes to the board again with the choice, and the
 * phone keeps the card as the server now serves it to its owner.
 */
export async function setShowRecord(ports: Ports, account: Account, show: boolean): Promise<OwnCard> {
  const card = publicCard(account);
  if (!card) throw new NoCardError("no card on the board");
  await apiClient(account.session).publishProfile({ ...card, show_record: show });
  return refreshOwnCard(recordsClient(account.session), ports.storage);
}
