import type { Payee } from "@gigsync/protocol";
import { NotBuiltError } from "../not-built.js";
import type { Storage } from "../ports.js";

/**
 * The worker's UPI ID and the name payers see: one record in this phone's settings (`Collection.settings`), never in a
 * payment, on the card or on a server (ADR 0011, LLD 2.4a). Payment requests and the in-person QR both read it here, at
 * the moment they need it, so the two can never drift apart.
 */
export const PAYEE_KEY = "payee";

/** What is wrong with payee details; the app says it in the owner's language. */
export const PayeeProblem = { vpa: "vpa", name: "name", name_long: "name_long" } as const;
export type PayeeProblem = (typeof PayeeProblem)[keyof typeof PayeeProblem];

export class PayeeError extends Error {
  constructor(readonly problem: PayeeProblem) {
    super(problem);
  }
}

/** Asking to be paid, or showing the QR, with no valid UPI ID saved. Thrown before anything is stored or sent. */
export class PayeeMissingError extends Error {}

export async function loadPayee(_storage: Storage): Promise<Payee | undefined> {
  throw new NotBuiltError("loadPayee");
}

/** Checks the details with the `Payee` schema, then saves them. */
export async function savePayee(_storage: Storage, _p: Payee): Promise<void> {
  throw new NotBuiltError("savePayee");
}
