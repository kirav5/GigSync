// The teacher: GigSync's model through Ollama (ADR 0052, 0065 §5). Locally that is the Mac Studio, through an SSH
// tunnel (`ssh -N -L 11435:localhost:11434 <user>@<studio>`), so the default address is the tunnel's end. One call is
// one JSON object held to a schema; anything else is no reply, and the target is dropped as unwritten or unlabelled.
import { core } from "./core.mjs";

export const TEACHER_URL = process.env.TEACHER_URL ?? "http://localhost:11435";
export const TEACHER_MODEL = process.env.TEACHER_MODEL ?? "qwen3:30b-a3b-instruct-2507-q4_K_M";

const GENERATE_PATH = "/api/generate";
const TAGS_PATH = "/api/tags";
/** Longer than the 30B ever takes for one short message, even loading. */
const REQUEST_LIMIT_MS = 120_000;
const TAGS_LIMIT_MS = 5_000;
const KEEP_ALIVE = "1h";

/** True when the teacher answers and has the model. */
export async function teacherReady(url = TEACHER_URL, model = TEACHER_MODEL) {
  try {
    const res = await fetch(`${url}${TAGS_PATH}`, { signal: AbortSignal.timeout(TAGS_LIMIT_MS) });
    if (!res.ok) return false;
    const { models } = await res.json();
    return (models ?? []).some((m) => m.name === model);
  } catch {
    return false;
  }
}

/** The teacher's reply to one prompt, as an object; null on any failure. */
export async function ask(prompt, { schema, temperature, maxTokens }, url = TEACHER_URL, model = TEACHER_MODEL) {
  try {
    const res = await fetch(`${url}${GENERATE_PATH}`, {
      method: core.HttpMethod.post,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        think: false,
        keep_alive: KEEP_ALIVE,
        format: schema,
        options: { temperature, num_predict: maxTokens },
      }),
      signal: AbortSignal.timeout(REQUEST_LIMIT_MS),
    });
    if (!res.ok) return null;
    const { response } = await res.json();
    const parsed = JSON.parse(response ?? "");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
