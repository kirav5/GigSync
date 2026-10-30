import { type Card, type Contact, runExpert } from "./experts.js";
import { log, pii } from "./log.js";
import { Collection, type Ports } from "./ports.js";
import { type Route, routeByKeywords } from "./router/keyword.js";

export interface Router {
  route(text: string, contacts: readonly string[]): Promise<Route>;
}

/** Keyword routing only. The model router (M1) implements the same interface. */
export class KeywordRouter implements Router {
  async route(text: string, contacts: readonly string[]) {
    return routeByKeywords(text, contacts);
  }
}

/** One message in, one card out. Everything the agent does goes through here, on every platform. */
export class Agent {
  constructor(
    private ports: Ports,
    private router: Router = new KeywordRouter(),
  ) {}

  async handle(text: string): Promise<{ route: Route; card: Card }> {
    const start = Date.now();
    log.debug("chat: input", { text: pii(text) });
    const contacts = await this.ports.storage.list<Contact>(Collection.contacts);
    const route = await this.router.route(
      text,
      contacts.map((c) => c.name),
    );
    log.debug("chat: routed", { expert: route.expert, contact: pii(route.contact), text: pii(route.text) });
    const card = await runExpert(route, this.ports, contacts);
    log.debug("chat: reply", { kind: card.kind, card: pii(JSON.stringify(card)) });
    // What happened, never what was said: the expert, the outcome, the size of the message and the time taken.
    log.info("chat handled", { expert: route.expert, card: card.kind, chars: text.length, ms: Date.now() - start });
    return { route, card };
  }
}
