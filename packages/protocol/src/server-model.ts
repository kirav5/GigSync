import { z } from "zod";

/**
 * GigSync's own model (ADR 0052): the phone asks the API, the API asks the model on GigSync's computer. The same
 * request the phone's engines take (core's `GenerateOptions`), so the agent never knows which one answered.
 */

/** Longer than any prompt the agent builds (a routing prompt with the chat so far, an interview turn). */
export const MODEL_PROMPT_MAX = 16_000;
/** The most a reply may run to; the agent asks for far less. */
export const MODEL_TOKENS_MAX = 1024;
/** A reply schema is a few hundred characters; this keeps a caller from sending a large one. */
export const MODEL_SCHEMA_MAX = 8_000;
const TEMPERATURE_MAX = 2;

/**
 * What a prompt is for, so each call's timing and outcome can be read by purpose in the logs, on the phone and on the
 * API. Logs carry the purpose, never the words.
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

/** `POST /v1/model/generate`. The model is the server's choice, never the caller's. */
export const ModelGenerateRequest = z.object({
  prompt: z.string().min(1).max(MODEL_PROMPT_MAX),
  max_tokens: z.number().int().min(1).max(MODEL_TOKENS_MAX).optional(),
  temperature: z.number().min(0).max(TEMPERATURE_MAX).optional(),
  /** One JSON object as the reply. */
  json: z.boolean().optional(),
  /** A JSON Schema the reply must fit. */
  schema: z
    .record(z.string(), z.unknown())
    .refine((s) => JSON.stringify(s).length <= MODEL_SCHEMA_MAX)
    .optional(),
  /** What the prompt is for, for the logs; absent from older phones. */
  purpose: ModelPurpose.optional(),
});
export type ModelGenerateRequest = z.infer<typeof ModelGenerateRequest>;

/** `GET /v1/model/status`: whether GigSync's model is set up on this API (it may still be down when asked). */
export const ServerModelStatus = z.object({ on: z.boolean() });
export type ServerModelStatus = z.infer<typeof ServerModelStatus>;

/** How a call went on GigSync's computer, as the model reports it: for the logs and for tuning, never the words. */
export const ModelUsage = z.object({
  /** The API's wait for the model, end to end. */
  ms: z.number().nonnegative(),
  /** Loading the model before it could answer; large after a quiet spell. */
  load_ms: z.number().nonnegative().optional(),
  prompt_tokens: z.number().int().nonnegative().optional(),
  reply_tokens: z.number().int().nonnegative().optional(),
});
export type ModelUsage = z.infer<typeof ModelUsage>;

/** The reply; null when the model gave nothing. */
export const ModelGenerateReply = z.object({ text: z.string().nullable(), usage: ModelUsage.optional() });
export type ModelGenerateReply = z.infer<typeof ModelGenerateReply>;
