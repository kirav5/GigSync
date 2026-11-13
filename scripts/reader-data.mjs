// Training data for the phone's reader (ADR 0065 §5): GigSync's model writes messages for drawn targets and labels
// them blind; only those where the two agree are kept. Run with `pnpm reader:data` (builds core first). Options:
//   --count N        targets to draw (default 500, a sample to read before a full run)
//   --seed S         the run's seed (default 1): the same seed draws the same targets
//   --out DIR        where the run's files go (default data/reader/v1, git-ignored); a run there already resumes
//   --concurrency C  targets in flight at once (default 4)
// The teacher is Ollama at TEACHER_URL (default the SSH tunnel's end, http://localhost:11435) running TEACHER_MODEL.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { doneIds, Files, finish, makeOne, record } from "./reader-data/run.mjs";
import { drawTarget } from "./reader-data/sample.mjs";
import { ask, TEACHER_MODEL, TEACHER_URL, TeacherDown, teacherReady, untilTeacher } from "./reader-data/teacher.mjs";

const DECIMAL = 10;
const DEFAULTS = { count: "500", seed: "1", out: "data/reader/v1", concurrency: "4" };
const PROGRESS_EVERY = 50;
const EXIT_NO_TEACHER = 1;

const { values } = parseArgs({
  options: {
    count: { type: "string" },
    seed: { type: "string" },
    out: { type: "string" },
    concurrency: { type: "string" },
  },
});
const settings = { ...DEFAULTS, ...values };
const count = Number.parseInt(settings.count, DECIMAL);
const seed = Number.parseInt(settings.seed, DECIMAL);
const concurrency = Number.parseInt(settings.concurrency, DECIMAL);
const dir = settings.out;

if (!(await teacherReady())) {
  console.error(`No ${TEACHER_MODEL} at ${TEACHER_URL}. Is the tunnel to the Mac Studio up?`);
  process.exit(EXIT_NO_TEACHER);
}
mkdirSync(dir, { recursive: true });
const run = { seed, count, concurrency, teacher: TEACHER_MODEL, started_at: new Date().toISOString() };
writeFileSync(join(dir, Files.run), `${JSON.stringify(run, null, 2)}\n`);
const done = doneIds(dir);
const todo = Array.from({ length: count }, (_, id) => id).filter((id) => !done.has(id));
console.log(`${todo.length} of ${count} targets to write (${done.size} done already) into ${dir}`);

/** One target, asked again for as long as the teacher is down: an outage is never a dropped target. */
async function madeWhenUp(target) {
  for (;;) {
    try {
      return await makeOne(target, ask);
    } catch (err) {
      if (!(err instanceof TeacherDown)) throw err;
      console.log(`${new Date().toISOString()} teacher down (${err.message}); waiting to retry target ${target.id}`);
      await untilTeacher();
    }
  }
}

let finished = 0;
const started = Date.now();
async function worker() {
  for (let id = todo.shift(); id !== undefined; id = todo.shift()) {
    const target = drawTarget(seed, id);
    record(dir, target, await madeWhenUp(target));
    finished += 1;
    if (finished % PROGRESS_EVERY === 0) {
      const perTarget = (Date.now() - started) / finished / 1000;
      console.log(
        `${finished} written, ${perTarget.toFixed(1)} s each, ~${Math.round((todo.length * perTarget) / 60)} min left`,
      );
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

const manifest = finish(dir, { seed, count, teacher: TEACHER_MODEL });
console.log(JSON.stringify(manifest, null, 2));
