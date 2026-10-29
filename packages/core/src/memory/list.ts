import { QuestionKey, Trade } from "@gigsync/protocol";
import { Collection } from "../ports.js";
import { load, save } from "./store.js";
import { FORGET_ALL, type MemoryDoc, type MemoryItem, MemoryItemKind, type MemoryOwner } from "./types.js";

const K = MemoryItemKind;
/** A list item's key is its kind and its id, e.g. `fact:rooms` or `person:usr_…`. */
const KEY_SEP = ":";
const itemKey = (kind: MemoryItemKind, id: string) => `${kind}${KEY_SEP}${id}`;

function dateOf(item: MemoryItem): string {
  if (item.kind === K.person) return item.person.last_on;
  if (item.kind === K.asked) return item.asked[0]?.on ?? "";
  return item.on;
}

function itemsOf(doc: MemoryDoc): MemoryItem[] {
  const items: MemoryItem[] = [];
  for (const fact of QuestionKey.options) {
    const d = doc.facts[fact];
    if (d) items.push({ kind: K.fact, key: itemKey(K.fact, fact), fact, value: d.value, on: d.on });
  }
  if (doc.area) items.push({ kind: K.area, key: itemKey(K.area, K.area), ...doc.area });
  for (const person of Object.values(doc.people)) {
    items.push({ kind: K.person, key: itemKey(K.person, person.user), person });
  }
  for (const trade of Trade.options) {
    const asked = doc.asked[trade];
    if (asked?.length) items.push({ kind: K.asked, key: itemKey(K.asked, trade), trade, asked });
  }
  return items;
}

/** Everything this owner's agent remembers, one item per line of the Profile list, newest first. */
export async function listMemory(owner: MemoryOwner): Promise<MemoryItem[]> {
  const items = itemsOf(await load(owner.storage, owner.me.user));
  return items.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
}

function without(doc: MemoryDoc, kind: string, id: string): MemoryDoc {
  const fact = QuestionKey.safeParse(id);
  if (kind === K.fact && fact.success) {
    const { [fact.data]: _gone, ...facts } = doc.facts;
    return { ...doc, facts };
  }
  if (kind === K.area) {
    const { area: _gone, ...rest } = doc;
    return rest;
  }
  if (kind === K.person) {
    const { [id]: _gone, ...people } = doc.people;
    return { ...doc, people };
  }
  const trade = Trade.safeParse(id);
  if (kind === K.asked && trade.success) {
    const { [trade.data]: _gone, ...asked } = doc.asked;
    return { ...doc, asked };
  }
  return doc;
}

/** Forgets one remembered item (by its list key), or everything this owner's agent remembers with `FORGET_ALL`. */
export async function forgetMemory(owner: MemoryOwner, key: string): Promise<void> {
  if (key === FORGET_ALL) return owner.storage.delete(Collection.memory, owner.me.user);
  const at = key.indexOf(KEY_SEP);
  if (at < 0) return;
  const doc = await load(owner.storage, owner.me.user);
  await save(owner.storage, without(doc, key.slice(0, at), key.slice(at + 1)));
}
