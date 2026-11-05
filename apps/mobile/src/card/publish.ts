import {
  aboutIsPrivate,
  arrangementMandates,
  arrangementRates,
  type CardDraft,
  CITY_RATES,
  localitySlug,
  mainOf,
  nearestPilotArea,
  type OwnCard,
  type Ports,
  refreshOwnCard,
  type TermPrefs,
  type WorkerRules,
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

/**
 * Puts the card on the board and keeps the private half on this phone, for the interview and the My card form alike.
 * The public card is what the board shows; the rules (lowest rate, what to see first) never leave the phone. The UPI
 * ID is not part of either: payment requests read it from About me at send time.
 */
export async function publishCard(ports: Ports, account: Account, draft: CardDraft, lang: Lang): Promise<Account> {
  const { trades = [], skills = [], rate_paise: rate, limit_paise: limit } = draft;
  const area = baseOf(draft);
  if (trades.length + skills.length === 0 || !area || rate === undefined || limit === undefined || limit > rate)
    throw new CardIncompleteError("card draft is incomplete");
  const main = mainOf(draft);
  const rates = arrangementRates(draft);
  // The owner's own language first: it is the one their card's free text is written in.
  const languages = [lang, ...(draft.languages ?? []).filter((l) => l !== lang)];
  const about = draft.about?.trim() ?? "";
  // Checked here, where the interview and the My card form meet, so neither path can put contact on the board.
  if (aboutIsPrivate(about)) throw new AboutPrivateError("the line about the work holds contact details");
  const card: BoardProfile = {
    display_name: account.contact.name,
    trades,
    ...(skills.length > 0 ? { skills } : {}),
    area: coarsePoint(area),
    area_name: area.name,
    rate_paise: rate,
    languages,
    about,
    ...(rates.length > 0 ? { arrangements: rates } : {}),
    ...withHours(draft.terms ?? account.worker?.terms),
  };
  const worker: WorkerRules = {
    trades,
    ...(skills.length > 0 ? { skills } : {}),
    rate: { opening_paise: rate, limit_paise: limit },
    // The agent's own copy stays on the phone as the worker set it; the board keeps the coarse one.
    base: { lat: area.lat, lon: area.lon },
    ...(draft.place ? { base_name: draft.place.name } : {}),
    radius_km: draft.radius_km ?? account.worker?.radius_km ?? DEFAULT_RADIUS_KM,
    ...(main && rates.length > 0
      ? { arrangements: arrangementMandates(rates, { opening_paise: rate, limit_paise: limit }, main) }
      : {}),
    rates: CITY_RATES,
    ask_me: draft.ask_me ?? [],
    ...withPrefs(draft.terms ?? account.worker?.terms),
  };
  // No record and no "show my record": the server computes the one and keeps the other as the worker last set it.
  await apiClient(account.session).publishProfile(card);
  const next: Account = { ...account, worker, languages, autoConfirm: draft.auto ?? false, about, listed: true };
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
    rate_paise: rules.rate.opening_paise,
    limit_paise: rules.rate.limit_paise,
    ...(account.languages ? { languages: account.languages } : {}),
    ...(account.about ? { about: account.about } : {}),
    ask_me: rules.ask_me ?? [],
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
