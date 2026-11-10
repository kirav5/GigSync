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

/**
 * The teacher could not be reached or failed (the tunnel down, Ollama restarting): not the target's fault, so the run
 * waits and asks again instead of dropping it.
 */
export class TeacherDown extends Error {}

/** How long a run waits between checks while the teacher is down. */
export const RETRY_EVERY_MS = 30_000;

/** Resolves once the teacher answers again, checking every `RETRY_EVERY_MS`. */
export async function untilTeacher(ready = teacherReady, wait = RETRY_EVERY_MS) {
  while (!(await ready())) await new Promise((resolve) => setTimeout(resolve, wait));
}

/**
 * The teacher's reply to one prompt, as an object; null when the reply is not the JSON asked for (the model's doing,
 * and the target is dropped). Throws `TeacherDown` when the teacher cannot be reached or answers with an error.
 */
export async function ask(prompt, { schema, temperature, maxTokens }, url = TEACHER_URL, model = TEACHER_MODEL) {
  let res;
  try {
    res = await fetch(`${url}${GENERATE_PATH}`, {
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
  } catch (err) {
    throw new TeacherDown(err instanceof Error ? err.name : String(err));
  }
  if (!res.ok) throw new TeacherDown(`HTTP ${res.status}`);
  try {
    const { response } = await res.json();
    const parsed = JSON.parse(response ?? "");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
