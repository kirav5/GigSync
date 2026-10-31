import { MAX_ROUNDS, Role } from "@gigsync/protocol";
import { type Mandate, type Move, MoveKind, priceAt, respond, type Strategy } from "../src/index.js";

const R = Role.enum;

/** One side's plan for a job: its mandate and, for a job planned since ADR 0033, its hidden strategy. */
export interface Side {
  mandate: Mandate;
  strategy?: Strategy;
}

export interface Haggled {
  /** How it ended: accepted or walked away. */
  move: Move["kind"];
  /** The price on the table when it ended: the accepted one, or the last offer. */
  price: number;
  by: Role;
  /** Every offer made, in order. */
  offers: { by: Role; price: number }[];
}

/** Plays both agents against each other the way two phones would, the worker quoting first. */
export function haggle(worker: Side, household: Side): Haggled {
  const made: Record<Role, number> = { [R.provider]: 1, [R.requester]: 0 };
  let price = priceAt(R.provider, worker.mandate, 1, worker.strategy);
  const offers = [{ by: R.provider as Role, price }];
  let turn: Role = R.requester;
  for (let i = 0; i < 4 * MAX_ROUNDS; i++) {
    const side = turn === R.requester ? household : worker;
    const move = respond(turn, side.mandate, made[turn], price, side.strategy);
    if (move.kind !== MoveKind.offer) return { move: move.kind, price, by: turn, offers };
    price = move.price_paise;
    offers.push({ by: turn, price });
    made[turn]++;
    turn = turn === R.requester ? R.provider : R.requester;
  }
  throw new Error("did not finish");
}

/**
 * The offers one side makes against a counterpart that never moves, up to its last round: what a stubborn
 * counterpart sees of its curve.
 */
export const curve = (role: Role, side: Side): number[] =>
  Array.from({ length: MAX_ROUNDS }, (_, i) => priceAt(role, side.mandate, i + 1, side.strategy));
