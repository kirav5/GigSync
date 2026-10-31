import { type MessageKey, MoveError, MoveProblem } from "@gigsync/core";
import { errorKey } from "../ui/errorKey.js";

/** Each reason a move did not happen, as the line that says it. */
const MOVE_PROBLEM: Readonly<Record<MoveProblem, MessageKey>> = {
  [MoveProblem.too_big]: "phone.problem_too_big",
  [MoveProblem.not_move]: "phone.problem_not_move",
  [MoveProblem.gone]: "phone.problem_gone",
  [MoveProblem.expired]: "phone.problem_expired",
  [MoveProblem.same_phone]: "phone.problem_same_phone",
  [MoveProblem.not_yours]: "phone.problem_not_yours",
  [MoveProblem.newer]: "phone.problem_newer",
  [MoveProblem.damaged]: "phone.problem_damaged",
  [MoveProblem.other_role]: "phone.problem_other_role",
  [MoveProblem.too_many]: "phone.problem_too_many",
};

/** What to tell the owner when a step of a move failed: the move's own reason, else no network or a generic error. */
export function moveErrorKey(err: unknown): MessageKey {
  return err instanceof MoveError ? MOVE_PROBLEM[err.problem] : errorKey(err);
}

/** Minutes and seconds left, as the old phone's countdown shows them: "14:05". */
export function clockOf(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
