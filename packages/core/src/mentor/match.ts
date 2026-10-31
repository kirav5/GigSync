import type { City, Lang, MatchRequestInput, MentorProfile, Trade } from "@gigsync/protocol";
import { apiOf, type MentorContext } from "./context.js";
import type { NewcomerPrefs } from "./types.js";

/** What the newcomer filters by on "Find a mentor"; women-only falls back to her own answer. */
export interface MentorFilters {
  city: City;
  trade: Trade;
  lang: Lang;
  women_only?: boolean;
}

/** Women-only is on for a newcomer who said she is a woman unless she switched it off, and off for everyone else. */
export const womenOnly = (prefs: NewcomerPrefs): boolean => prefs.women_only ?? prefs.woman === true;

/**
 * The match the server runs, both ways round: women-only asks only for mentors who said they are women, and only a
 * newcomer who said she is a woman is shown mentors who help women only. Her answer travels as a filter and is not
 * kept by the server.
 */
export function matchQuery(prefs: NewcomerPrefs, f: MentorFilters): MatchRequestInput {
  return {
    city: f.city,
    trade: f.trade,
    lang: f.lang,
    women_only: f.women_only ?? womenOnly(prefs),
    woman: prefs.woman === true,
  };
}

/**
 * Mentors the server matched, most jobs first, without this owner and anyone they blocked. The server only filters;
 * the newcomer chooses, and no model ranks anyone.
 */
export async function findMentors(m: MentorContext, f: MentorFilters): Promise<MentorProfile[]> {
  const prefs = (await m.store.newcomer()) ?? {};
  const [found, blocked] = await Promise.all([apiOf(m).matchMentors(matchQuery(prefs, f)), m.store.blocked()]);
  return found.filter((p) => p.user !== m.ctx.me.user && !blocked.has(p.user));
}

/** Her answer, asked once and changeable: saying she is a woman turns women-only on, saying not turns it off. */
export async function answerWoman(m: MentorContext, woman: boolean): Promise<NewcomerPrefs> {
  const next: NewcomerPrefs = { ...((await m.store.newcomer()) ?? {}), woman, women_only: woman };
  await m.store.saveNewcomer(next);
  return next;
}

/** She may switch women-only off (or on) at any time. */
export async function setWomenOnly(m: MentorContext, on: boolean): Promise<NewcomerPrefs> {
  const next: NewcomerPrefs = { ...((await m.store.newcomer()) ?? {}), women_only: on };
  await m.store.saveNewcomer(next);
  return next;
}

/** The safety words were shown and read: they come before any contact, once. */
export async function safetySeen(m: MentorContext): Promise<NewcomerPrefs> {
  const next: NewcomerPrefs = { ...((await m.store.newcomer()) ?? {}), safety_seen: true };
  await m.store.saveNewcomer(next);
  return next;
}
