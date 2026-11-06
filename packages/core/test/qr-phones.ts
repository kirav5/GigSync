import {
  type BoardProfile,
  type MyQr,
  type MyQrRequest,
  OfferRefusal,
  type QrCode,
  type QrPerson,
  QrRole,
  RecommendRefusal,
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
  private readonly hired = new Set<string>();
  readonly cards = new Map<UserId, BoardProfile>();
  /** How many times a worker's code was asked for, to see that a phone refused by itself. */
  recommended = 0;
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
      recommendWorker: async (worker) => this.recommendWorker(caller(), worker),
      workerCard: async (user) => this.cards.get(user),
    };
  }

  /** A worker with a card and a live code, on a job record with `household`. Returns their code. */
  listWorker(worker: UserId, household: UserId): QrCode {
    this.cards.set(worker, { display_name: "Ravi", trades: ["electrician"], area_name: "Indiranagar" } as BoardProfile);
    this.hired.add(`${worker}|${household}`);
    return this.mine(worker, { role: QrRole.enum.worker, first_name: "Ravi" }, false).code;
  }

  unlist(worker: UserId): void {
    this.cards.delete(worker);
  }

  forgetJob(worker: UserId, household: UserId): void {
    this.hired.delete(`${worker}|${household}`);
  }

  private recommendWorker(household: UserId, worker: UserId): { code: QrCode } {
    this.recommended += 1;
    if (!this.hired.has(`${worker}|${household}`)) throw new HttpError(FORBIDDEN, RecommendRefusal.enum.no_job_record);
    if (!this.cards.has(worker)) throw new HttpError(FORBIDDEN, RecommendRefusal.enum.not_listed);
    const owner = this.owners.get(worker);
    if (!owner) throw new HttpError(NOT_FOUND, "not found");
    return { code: this.mine(worker, owner, false).code };
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
