import { randomBytes } from "node:crypto";
import {
  type BoardProfile,
  type Envelope,
  EnvelopeKind,
  MyQrRequest,
  QR_CODE_BYTES,
  type QrPerson,
  QrRole,
  Session,
  type UserId,
} from "@gigsync/protocol";
import type { Page, Route } from "@playwright/test";
import { API, APP } from "./helpers.js";

/** Where Capacitor's Preferences keep the signed-in account in a browser (adapters/ports.ts, adapters/account.ts). */
const ACCOUNT_KEY = "CapacitorStorage.settings:account";
const QR_ROUTES = `${API}/v1/qr/**`;
const BEARER = "Bearer ";
const MAILBOX = `${API}/v1/mailbox/*`;
const INBOX = `${API}/v1/inbox`;
const CORS = {
  "access-control-allow-origin": APP,
  "access-control-allow-headers": "content-type, authorization",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
};
const json = (route: Route, status: number, body?: unknown) =>
  route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body ?? {}) });

/**
 * workers/api's personal QR routes, answered in the browser: migration 0005 is not on Neon yet, so the API the UI tests
 * run against cannot serve them (workers/api/test/qr*.test.ts test the real routes on a local Postgres). For the same
 * reason the mailbox's check on a work_offer envelope cannot run there, so the offer travels between the two pages
 * here: taken from the worker's POST and added to the household's next inbox fetch. Every other envelope goes through
 * the real mailbox, and the household's phone still checks the offer's signature against the real directory.
 */
export class FakeQr {
  private readonly owners = new Map<UserId, MyQrRequest>();
  private readonly live = new Map<string, UserId>();
  private readonly sessions = new Map<string, UserId>();
  private readonly offers = new Map<UserId, Envelope[]>();
  /** Board cards, as the test published them, for a worker's QR to show. */
  readonly cards = new Map<UserId, BoardProfile>();

  /** Answers the QR routes for this page and carries its offers, from before sign-in on. */
  async attach(page: Page): Promise<void> {
    await page.route(QR_ROUTES, (route) => this.qr(page, route));
    await page.route(MAILBOX, (route) => this.deliver(route));
    await page.route(INBOX, (route) => this.inbox(page, route));
  }

  /** Who is signed in on this page, as the app keeps it. */
  async session(page: Page): Promise<Session> {
    const session = Session.parse(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").session, ACCOUNT_KEY),
    );
    this.sessions.set(session.token, session.user);
    return session;
  }

  /** The caller of a request, by its bearer token. */
  private async caller(page: Page, route: Route): Promise<UserId | undefined> {
    const token = (route.request().headers().authorization ?? "").replace(BEARER, "");
    if (!this.sessions.has(token)) await this.session(page).catch(() => undefined);
    return this.sessions.get(token);
  }

  /** The owner's live code. */
  codeOf(user: UserId): string {
    const code = [...this.live.entries()].find(([, u]) => u === user)?.[0];
    if (!code) throw new Error("no live code for that user");
    return code;
  }

  private async qr(page: Page, route: Route): Promise<void> {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const user = await this.caller(page, route);
    if (!user) return json(route, 401, { error: "unauthorized" });
    const [code, action] = new URL(req.url()).pathname.split("/").slice(3);
    if (code === "me") return json(route, 200, this.mine(user, MyQrRequest.parse(req.postDataJSON()), !!action));
    const person = code ? this.person(code) : undefined;
    if (!person) return json(route, 404, { error: "not found" });
    if (!action) return json(route, 200, person);
    return route.fulfill({ status: 204, headers: CORS });
  }

  private mine(user: UserId, owner: MyQrRequest, replace: boolean) {
    this.owners.set(user, owner);
    const current = [...this.live.entries()].find(([, u]) => u === user)?.[0];
    if (current && !replace) return { code: current, created_at: new Date().toISOString() };
    if (current) this.live.delete(current);
    const code = randomBytes(QR_CODE_BYTES).toString("base64url");
    this.live.set(code, user);
    return { code, created_at: new Date().toISOString() };
  }

  private person(code: string): QrPerson | undefined {
    const user = this.live.get(code);
    const owner = user && this.owners.get(user);
    if (!user || !owner) return undefined;
    if (owner.role === QrRole.enum.household) return { role: owner.role, user, first_name: owner.first_name };
    return { role: QrRole.enum.worker, user, first_name: owner.first_name, card: this.cards.get(user) ?? null };
  }

  private async deliver(route: Route): Promise<void> {
    const req = route.request();
    const e = req.method() === "POST" ? (req.postDataJSON() as Envelope) : undefined;
    if (e?.kind !== EnvelopeKind.enum.work_offer) return route.fallback();
    this.offers.set(e.to.user, [...(this.offers.get(e.to.user) ?? []), e]);
    return json(route, 201, { stored: true, devices: 1 });
  }

  private async inbox(page: Page, route: Route): Promise<void> {
    const user = route.request().method() === "GET" ? await this.caller(page, route) : undefined;
    if (!user) return route.fallback();
    // The page may close while the real inbox answers; nothing is waiting for the answer then.
    const res = await route.fetch().catch(() => undefined);
    if (!res) return route.abort().catch(() => undefined);
    const held = (await res.json()) as unknown[];
    const offers = this.offers.get(user) ?? [];
    this.offers.delete(user);
    return route.fulfill({ response: res, json: [...held, ...offers] });
  }
}
