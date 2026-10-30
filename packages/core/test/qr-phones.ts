import {
  type BoardProfile,
  type MyQr,
  type MyQrRequest,
  OfferRefusal,
  type QrCode,
  type QrPerson,
  QrRole,
  type UserId,
} from "@gigsync/protocol";
import { HttpError, type QrApi } from "../src/index.js";

const NOT_FOUND = 404;
const FORBIDDEN = 403;

/** workers/api's personal QR routes in memory: live codes, replaced codes, board cards, one offer per code. */
export class FakeQrServer {
  private readonly owners = new Map<UserId, MyQrRequest>();
  private readonly live = new Map<QrCode, UserId>();
  private readonly offered = new Set<string>();
  readonly cards = new Map<UserId, BoardProfile>();
  private next = 0;

  /** The routes as one signed-in caller sees them. */
  for(caller: () => UserId): QrApi {
    return {
      myQr: async (owner) => this.mine(caller(), owner, false),
      replaceQr: async (owner) => this.mine(caller(), owner, true),
      lookupQr: async (code) => this.person(code),
      takeOffer: async (code) => {
        const p = this.person(code);
        if (p.role !== QrRole.enum.household || p.user === caller())
          throw new HttpError(FORBIDDEN, OfferRefusal.enum.not_household);
        const key = `${caller()}|${code}`;
        if (this.offered.has(key)) throw new HttpError(429, OfferRefusal.enum.offered_today);
        this.offered.add(key);
      },
    };
  }

  private mine(user: UserId, owner: MyQrRequest, replace: boolean): MyQr {
    this.owners.set(user, owner);
    const current = [...this.live.entries()].find(([, u]) => u === user)?.[0];
    if (current && !replace) return { code: current, created_at: new Date().toISOString() };
    if (current) this.live.delete(current);
    const code = `code${String(++this.next).padStart(8, "0")}`;
    this.live.set(code, user);
    return { code, created_at: new Date().toISOString() };
  }

  private person(code: QrCode): QrPerson {
    const user = this.live.get(code);
    const owner = user && this.owners.get(user);
    if (!user || !owner) throw new HttpError(NOT_FOUND, "not found");
    if (owner.role === QrRole.enum.household) return { role: owner.role, user, first_name: owner.first_name };
    return { role: QrRole.enum.worker, user, first_name: owner.first_name, card: this.cards.get(user) ?? null };
  }
}

/** The routes for one phone whose user id is known only once it exists. */
export function qrApiFor(server: FakeQrServer): { api: QrApi; bind: (user: UserId) => void } {
  const caller: { user?: UserId } = {};
  const api = server.for(() => {
    if (!caller.user) throw new Error("no caller yet");
    return caller.user;
  });
  return { api, bind: (user) => (caller.user = user) };
}
