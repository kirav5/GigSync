import { type Card, type Contact, runExpert } from "./experts.js";
import type { Ports } from "./ports.js";
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
    const contacts = await this.ports.storage.list<Contact>("contacts");
    const route = await this.router.route(
      text,
      contacts.map((c) => c.name),
    );
    const card = await runExpert(route, this.ports, contacts);
    await this.ports.storage.put("chat", `ch_${Date.now()}`, {
      text,
      route,
      card,
      at: this.ports.clock.now().toISOString(),
    });
    return { route, card };
  }
}
