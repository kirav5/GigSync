import {
  ChatRole,
  type ChatRoute,
  Collection,
  type Contact,
  keywordRoute,
  NeedSlot,
  type Ports,
  routeChat,
} from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";

/**
 * Where a household's message in Find goes (ADR 0040): the need's first sentence is routed by the phone's model when it
 * has one, else by the word lists; later answers stay with the need's questions, where only the lists listen for a
 * market question, as before, so an answer like "Jayanagar" or "up to 8000" is never sent anywhere else.
 */
export async function findRoute(ports: Ports, lang: Lang, text: string, slot: NeedSlot): Promise<ChatRoute> {
  if (slot !== NeedSlot.trade) return keywordRoute(text, { lang, role: ChatRole.household, contacts: [] });
  const contacts = await ports.storage.list<Contact>(Collection.contacts);
  return routeChat(text, { lang, role: ChatRole.household, contacts: contacts.map((c) => c.name) }, ports.model);
}
