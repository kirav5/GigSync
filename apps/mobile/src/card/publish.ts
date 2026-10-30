import {
  aboutIsPrivate,
  type CardDraft,
  CITY_RATES,
  keepPublishedRecord,
  myCardRecord,
  type Ports,
  type TermPrefs,
  type WorkerRules,
} from "@gigsync/core";
import type { BoardProfile, Lang } from "@gigsync/protocol";
import { type Account, apiClient, saveAccount } from "../adapters/account.js";
import { AREAS } from "../ui/places.js";

/** How far a worker goes from their area's centre until the card lets them say. */
const DEFAULT_RADIUS_KM = 10;

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
  const { trades, rate_paise: rate, limit_paise: limit } = draft;
  const area = AREAS.find((a) => a.key === draft.area);
  if (!trades?.length || !area || rate === undefined || limit === undefined || limit > rate)
    throw new CardIncompleteError("card draft is incomplete");
  // The owner's own language first: it is the one their card's free text is written in.
  const languages = [lang, ...(draft.languages ?? []).filter((l) => l !== lang)];
  const about = draft.about?.trim() ?? "";
  // Checked here, where the interview and the My card form meet, so neither path can put contact on the board.
  if (aboutIsPrivate(about)) throw new AboutPrivateError("the line about the work holds contact details");
  const card: BoardProfile = {
    display_name: account.contact.name,
    trades,
    area: { lat: area.lat, lon: area.lon },
    area_name: area.name,
    rate_paise: rate,
    languages,
    about,
  };
  const worker: WorkerRules = {
    trades,
    rate: { opening_paise: rate, limit_paise: limit },
    base: card.area,
    radius_km: account.worker?.radius_km ?? DEFAULT_RADIUS_KM,
    rates: CITY_RATES,
    ask_me: draft.ask_me ?? [],
    // The card interview does not ask them: keep what the form set.
    ...withPrefs(draft.terms ?? account.worker?.terms),
  };
  // The record goes with every publish, so a changed card never drops it from the board.
  const record = await myCardRecord(ports.storage);
  await apiClient(account.session).publishProfile({ ...card, ...record });
  await keepPublishedRecord(ports.storage, record);
  const next: Account = { ...account, worker, languages, autoConfirm: draft.auto ?? false, about, listed: true };
  await saveAccount(ports, next);
  return next;
}

/** The card this phone holds now, as a draft: where the interview starts from and the form's defaults. */
export function accountDraft(account: Account): CardDraft {
  const rules = account.worker;
  if (!rules) return {};
  const area = AREAS.find((a) => a.lat === rules.base.lat && a.lon === rules.base.lon);
  return {
    trades: rules.trades,
    ...(area ? { area: area.key } : {}),
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
  const area = AREAS.find((a) => a.lat === rules.base.lat && a.lon === rules.base.lon);
  return {
    display_name: account.contact.name,
    trades: rules.trades,
    area: rules.base,
    area_name: area?.name ?? AREAS[0].name,
    rate_paise: rules.rate.opening_paise,
    languages: account.languages ?? [],
    about: account.about ?? "",
  };
}
