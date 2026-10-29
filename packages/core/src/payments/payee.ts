import { PAYEE_NAME_MAX, Payee } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";

/**
 * The worker's UPI ID and the name payers see: one record in the owner's settings (`Collection.ownerSettings`), never in a
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

/** The saved payee, checked again on the way out: a record that no longer passes the schema counts as none. */
export async function loadPayee(storage: Storage): Promise<Payee | undefined> {
  const parsed = Payee.safeParse(await storage.get<unknown>(Collection.ownerSettings, PAYEE_KEY));
  return parsed.success ? parsed.data : undefined;
}

/**
 * Checks the details with the `Payee` schema, then saves them. Spaces around either field are dropped, as a phone
 * keyboard adds them; the UPI ID is checked first, so the owner fixes one thing at a time.
 */
export async function savePayee(storage: Storage, p: Payee): Promise<void> {
  const vpa = p.vpa.trim();
  const name = p.name.trim();
  if (!Payee.shape.vpa.safeParse(vpa).success) throw new PayeeError(PayeeProblem.vpa);
  if (name.length > PAYEE_NAME_MAX) throw new PayeeError(PayeeProblem.name_long);
  const parsed = Payee.safeParse({ vpa, name });
  if (!parsed.success) throw new PayeeError(PayeeProblem.name);
  await storage.put(Collection.ownerSettings, PAYEE_KEY, parsed.data);
}
