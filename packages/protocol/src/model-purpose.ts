import { z } from "zod";

/**
 * What a prompt is for, so each call to the model that answers on this device (core's `GenerateOptions`) can be read
 * by purpose in the logs. Logs carry the purpose, never the words.
 */
export const ModelPurpose = z.enum([
  /** Talk's router: which screen or answer a message is for. */
  "route",
  "expert_answer",
  "expert_chat",
  "landing",
  "moving_outlook",
  /** Find: the one reader of a household's message (ADR 0056). */
  "read_turn",
  "need",
  "job_type",
  "scope",
  "first_question",
  "price",
  "market",
  /** Kinds of work: the worker's words to a kind, and wordings of the same work. */
  "suggest_work",
  "same_work",
  /** The worker's agent's questions to a household (ADR 0063), and the household's agent's answers. */
  "worker_questions",
  "household_answers",
  "tactic",
  "terms",
  "explain",
]);
export type ModelPurpose = z.infer<typeof ModelPurpose>;
