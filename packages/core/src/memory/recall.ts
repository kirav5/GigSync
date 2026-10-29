import { type QuestionKey, Role, type Trade, type UserId } from "@gigsync/protocol";
import { load } from "./store.js";
import type { Asked, Dated, MemoryOwner, Person, Recall } from "./types.js";

/** Questions asked before that a prompt mentions, newest first: enough to avoid repeats, short enough for a phone. */
const SUMMARY_ASKED_MAX = 5;

const valuesOf = (dated: Partial<Record<QuestionKey, Dated>>): Partial<Record<QuestionKey, string>> =>
  Object.fromEntries(Object.entries(dated).map(([key, d]) => [key, d?.value]));

function recalledPerson(p: Person): NonNullable<Recall["person"]> {
  return {
    ...(p.name ? { name: p.name } : {}),
    role: p.role,
    jobs: p.jobs,
    trades: p.trades,
    details: valuesOf(p.details),
    last_on: p.last_on,
  };
}

/**
 * What this owner's agent remembers that bears on a job in this trade with this counterpart: the counterpart if they
 * did a signed job together before, and what was asked before for this trade (worker side). Prices are never part of
 * it. The household's own facts, which its agent answers from, are `householdKnown`.
 */
export async function recall(owner: MemoryOwner, trade: Trade, counterpart?: UserId): Promise<Recall> {
  const doc = await load(owner.storage, owner.me.user);
  const person = counterpart ? doc.people[counterpart] : undefined;
  return {
    ...(person ? { person: recalledPerson(person) } : {}),
    askedBefore: doc.asked[trade] ?? [],
  };
}

const listed = (values: Partial<Record<QuestionKey, string>>) =>
  Object.entries(values)
    .map(([key, value]) => `${key} ${value}`)
    .join("; ");

const askedLine = (a: Asked) => `${a.text ? `"${a.text}"` : a.key} (${a.answered ? "answered" : "not answered"})`;

function personLines(p: NonNullable<Recall["person"]>): string[] {
  const who = p.role === Role.enum.requester ? "this household" : "this worker";
  const lines = [`You have done ${p.jobs} signed job(s) with ${who}, the last on ${p.last_on}.`];
  const details = listed(p.details);
  if (details) lines.push(`Last time they said: ${details}.`);
  return lines;
}

/**
 * A short plain-English note for a model prompt, from the worker's side: the jobs done with this counterpart, the
 * stable details they gave, and what was asked before for this trade. It names nobody and carries no price, phone
 * or address; it is empty when there is nothing to say.
 */
export async function summary(owner: MemoryOwner, trade: Trade, counterpart?: UserId): Promise<string> {
  const known = await recall(owner, trade, counterpart);
  const lines = known.person ? personLines(known.person) : [];
  const asked = known.askedBefore.slice(0, SUMMARY_ASKED_MAX);
  if (asked.length > 0) lines.push(`Asked before for ${trade} jobs: ${asked.map(askedLine).join("; ")}.`);
  return lines.join(" ");
}
