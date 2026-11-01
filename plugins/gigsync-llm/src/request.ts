import type { AppConfig, ChatCompletionRequestNonStreaming, ModelRecord } from "@mlc-ai/web-llm";
import { ALL_IDS } from "./catalog.js";
import type { GenerateOptions } from "./definitions.js";

/**
 * What the web engine hands WebLLM: the app config naming our models (and where their files are), and one chat
 * completion per prompt. Types only from WebLLM here, so this module costs the first load nothing.
 */

/** Reply length when the caller does not ask for one, as core's DEFAULT_MAX_TOKENS. */
const DEFAULT_MAX_TOKENS = 256;
const USER = "user";
const JSON_OBJECT = "json_object";
/**
 * Any JSON object, when the caller gives no schema of its own. WebLLM 0.2.86 hands `json_object` without a schema to
 * XGrammar as undefined, which throws ("Cannot pass non-string to std::string"), so a schema is always given.
 */
const ANY_OBJECT_SCHEMA = JSON.stringify({ type: "object" });
/** WebLLM's best-tested cache, and the one whose shards survive an interrupted download. */
const CACHE_BACKEND = "cache";
/** Under the base URL, the WebGPU libraries sit in one folder beside the models'. */
const LIBS = "libs";
const SLASH = "/";
const LAST_PART = /[^/]+$/;

/**
 * One prompt as a single user turn, with the caller's length, temperature and JSON wish. A model that `thinks` is told
 * not to: WebLLM then starts the reply with an empty thinking block, which a model without one would read as noise.
 */
export function completionRequest(options: GenerateOptions, thinks = false): ChatCompletionRequestNonStreaming {
  return {
    messages: [{ role: USER, content: options.prompt }],
    stream: false,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
    ...(options.json
      ? {
          response_format: {
            type: JSON_OBJECT,
            schema: options.schema ? JSON.stringify(options.schema) : ANY_OBJECT_SCHEMA,
          },
        }
      : {}),
    ...(thinks ? { extra_body: { enable_thinking: false } } : {}),
  };
}

/**
 * A model's record with its files moved under `base`: the repo's files at `<base>/<model_id>/resolve/main/…` (WebLLM
 * adds "resolve/main/"), and the library at `<base>/libs/<file>.wasm`. LLD §9.1 says how to fill a bucket that way.
 */
function moved(record: ModelRecord, base: string): ModelRecord {
  const root = base.endsWith(SLASH) ? base : `${base}${SLASH}`;
  const lib = LAST_PART.exec(record.model_lib)?.[0] ?? record.model_lib;
  return { ...record, model: `${root}${record.model_id}${SLASH}`, model_lib: `${root}${LIBS}${SLASH}${lib}` };
}

/** WebLLM's own records for our models, from its prebuilt config, served from `baseUrl` when one is set. */
export function appConfigFor(prebuilt: AppConfig, baseUrl?: string): AppConfig {
  const ours = prebuilt.model_list.filter((r) => ALL_IDS.includes(r.model_id));
  return {
    model_list: baseUrl ? ours.map((r) => moved(r, baseUrl)) : ours,
    cacheBackend: CACHE_BACKEND,
  };
}
