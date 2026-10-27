import { MAX_ROUNDS } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type Mandate, MoveKind, priceAt, respond, validMandate } from "../src/index.js";

const worker: Mandate = { opening_paise: 70000, limit_paise: 55000 };
const consumer: Mandate = { opening_paise: 45500, limit_paise: 65000 };

/** Plays both agents against each other the way two phones would, worker opening. */
function haggle(w: Mandate, c: Mandate) {
  let wOffers = 1;
  let cOffers = 0;
  let price = priceAt("provider", w, 1);
  let turn: "requester" | "provider" = "requester";
  for (let i = 0; i < 4 * MAX_ROUNDS; i++) {
    const mine = turn === "requester" ? c : w;
    const made = turn === "requester" ? cOffers : wOffers;
    const move = respond(turn, mine, made, price);
    if (move.kind !== MoveKind.offer) return { move: move.kind, price, by: turn };
    price = move.price_paise;
    if (turn === "requester") cOffers++;
    else wOffers++;
    turn = turn === "requester" ? "provider" : "requester";
  }
  throw new Error("did not finish");
}

describe("negotiation", () => {
  it("each side opens at its own price and reaches its limit by the horizon, in whole ₹10s", () => {
    expect(priceAt("provider", worker, 1)).toBe(70000);
    expect(priceAt("provider", worker, 5)).toBe(55000);
    expect(priceAt("requester", consumer, 1)).toBe(45000);
    expect(priceAt("requester", consumer, 9)).toBe(65000);
    for (let r = 1; r <= 6; r++) expect(priceAt("provider", worker, r) % 1000).toBe(0);
  });
  it("concessions only ever move toward the limit", () => {
    for (let r = 1; r < 6; r++)
      expect(priceAt("provider", worker, r + 1)).toBeLessThanOrEqual(priceAt("provider", worker, r));
  });
  it("agrees inside both limits when they overlap", () => {
    const end = haggle(worker, consumer);
    expect(end.move).toBe(MoveKind.accept);
    expect(end.price).toBeGreaterThanOrEqual(worker.limit_paise);
    expect(end.price).toBeLessThanOrEqual(consumer.limit_paise);
  });
  it("walks away without a deal when the limits do not overlap", () => {
    const end = haggle(worker, { opening_paise: 30000, limit_paise: 50000 });
    expect(end.move).toBe(MoveKind.walk);
  });
  it("accepts at once an offer better than its own next one", () => {
    expect(respond("requester", consumer, 0, 40000).kind).toBe(MoveKind.accept);
    expect(respond("provider", worker, 1, 80000).kind).toBe(MoveKind.accept);
  });
  it("never accepts past the limit, however many rounds", () => {
    expect(respond("provider", worker, MAX_ROUNDS, 54000).kind).toBe(MoveKind.walk);
  });
  it("checks that a mandate opens on the right side of its limit", () => {
    expect(validMandate("provider", worker)).toBe(true);
    expect(validMandate("provider", { opening_paise: 50000, limit_paise: 60000 })).toBe(false);
    expect(validMandate("requester", consumer)).toBe(true);
  });
});
