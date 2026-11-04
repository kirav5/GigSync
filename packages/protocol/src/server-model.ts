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
});
export type ModelGenerateRequest = z.infer<typeof ModelGenerateRequest>;

/** `GET /v1/model/status`: whether GigSync's model is set up on this API (it may still be down when asked). */
export const ServerModelStatus = z.object({ on: z.boolean() });
export type ServerModelStatus = z.infer<typeof ServerModelStatus>;

/** The reply; null when the model gave nothing. */
export const ModelGenerateReply = z.object({ text: z.string().nullable() });
export type ModelGenerateReply = z.infer<typeof ModelGenerateReply>;
