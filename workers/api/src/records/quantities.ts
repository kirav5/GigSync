import { canonicalJson, type JobQuantities } from "@gigsync/protocol";
import { fieldsFrom, type JobFields } from "./fields.js";

/**
 * A record's quantities (ADR 0041 §4) beside the fields two sides must agree on. They are not part of that agreement:
 * an older phone sends none, and a household may not know the area its worker measured. So two submissions are
 * compared without them, and the record keeps what either side sent, or nothing where both sent different ones.
 */

/** A job's fields without its quantities, as two submissions are compared. */
function comparable(f: JobFields): string {
  const { quantities: _quantities, ...rest } = f;
  return canonicalJson(rest);
}

/** Two stored or submitted field texts describe the same job, quantities aside. */
export const sameJob = (a: string, b: string): boolean => comparable(fieldsFrom(a)) === comparable(fieldsFrom(b));

/** What a record keeps from two sides' quantities: one side's, or neither when both sent and they differ. */
export function mergeQuantities(
  mine: JobQuantities | undefined,
  theirs: JobQuantities | undefined,
): JobQuantities | undefined {
  if (!mine) return theirs;
  if (!theirs) return mine;
  return canonicalJson(mine) === canonicalJson(theirs) ? mine : undefined;
}
