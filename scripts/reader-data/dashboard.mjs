// A live view of a reader-data run (ADR 0065 §5), served on this machine only: `pnpm reader:watch [--out DIR]`, then
// open http://localhost:8790. It reads the run's files as they grow (only the new lines each time), so it can watch a
// run of any size, started before or after it; nothing leaves the machine.
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Files } from "./run.mjs";
import { TEACHER_MODEL, TEACHER_URL, teacherReady } from "./teacher.mjs";

const PORT = Number(process.env.READER_WATCH_PORT ?? 8790);
const HOST = "127.0.0.1";
const { values } = parseArgs({ options: { out: { type: "string" } } });
const dir = values.out ?? "data/reader/v1";
const PAGE = readFileSync(new URL("./dashboard.html", import.meta.url), "utf8");

/** Targets per minute over this window, so a stall shows within minutes and one slow call does not. */
const RATE_WINDOW_MS = 5 * 60_000;
/** How many of the latest targets the "recent" keep rate is over. */
const RECENT = 300;
const SHOWN_KEPT = 8;
const SHOWN_DROPPED = 6;
const TEACHER_EVERY_MS = 15_000;
const MS_PER_MIN = 60_000;
const JSON_TYPE = { "content-type": "application/json" };
const HTML_TYPE = { "content-type": "text/html; charset=utf-8" };

/** One growing JSONL file, read from where the last read stopped; a file that shrank is read again from the start. */
function tail() {
  let offset = 0;
  let rest = "";
  return (path) => {
    if (!existsSync(path)) return [];
    const size = statSync(path).size;
    if (size < offset) [offset, rest] = [0, ""];
    if (size === offset) return [];
    const fd = openSync(path, "r");
    const buffer = Buffer.alloc(size - offset);
    readSync(fd, buffer, 0, buffer.length, offset);
    closeSync(fd);
    offset = size;
    const lines = (rest + buffer.toString("utf8")).split("\n");
    rest = lines.pop() ?? "";
    return lines.filter(Boolean).map((line) => JSON.parse(line));
  };
}

const readKept = tail();
const readDropped = tail();
const state = { kept: [], dropped: [], outcomes: [], samples: [], teacher: { up: false, at: 0 } };

const bump = (counts, key) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

function refresh() {
  for (const e of readKept(join(dir, Files.kept))) {
    state.kept.push(e);
    state.outcomes.push(true);
  }
  for (const d of readDropped(join(dir, Files.dropped))) {
    state.dropped.push({ reason: d.dropped, message: d.message, turn: d.target?.turn });
    state.outcomes.push(false);
  }
  const now = Date.now();
  state.samples.push([now, state.outcomes.length]);
  state.samples = state.samples.filter(([t]) => now - t <= RATE_WINDOW_MS);
}

async function teacher() {
  if (Date.now() - state.teacher.at > TEACHER_EVERY_MS) state.teacher = { up: await teacherReady(), at: Date.now() };
  return { up: state.teacher.up, url: TEACHER_URL, model: TEACHER_MODEL };
}

const readJson = (name) => (existsSync(join(dir, name)) ? JSON.parse(readFileSync(join(dir, name), "utf8")) : null);
const lastWrite = () =>
  Math.max(
    0,
    ...[Files.kept, Files.dropped]
      .map((f) => join(dir, f))
      .filter(existsSync)
      .map((p) => statSync(p).mtimeMs),
  );

async function stats() {
  refresh();
  const done = state.outcomes.length;
  const recent = state.outcomes.slice(-RECENT);
  const [first] = state.samples;
  const [lastAt, lastDone] = state.samples[state.samples.length - 1];
  const minutes = (lastAt - first[0]) / MS_PER_MIN;
  const perMin = minutes > 0 ? (lastDone - first[1]) / minutes : 0;
  const run = readJson(Files.run);
  const left = run ? Math.max(0, run.count - done) : 0;
  const reasons = {};
  for (const d of state.dropped) bump(reasons, d.reason);
  const byTurn = {};
  const bySlot = {};
  for (const e of state.kept) {
    bump(byTurn, e.turn);
    for (const s of e.spans) bump(bySlot, s.slot);
  }
  const written = lastWrite();
  const manifest = readJson(Files.manifest);
  return {
    dir,
    run,
    finished: manifest !== null && (!run || manifest.finished_at >= run.started_at),
    done,
    kept: state.kept.length,
    keepRate: done ? state.kept.length / done : 0,
    recentKeepRate: recent.length ? recent.filter(Boolean).length / recent.length : 0,
    perMin,
    etaMin: perMin > 0 ? left / perMin : null,
    lastWriteAgoS: written ? (Date.now() - written) / 1000 : null,
    teacher: await teacher(),
    reasons,
    byTurn,
    bySlot,
    recentKept: state.kept.slice(-SHOWN_KEPT).reverse(),
    recentDropped: state.dropped.slice(-SHOWN_DROPPED).reverse(),
  };
}

createServer(async (req, res) => {
  if (req.url === "/stats") {
    res.writeHead(200, JSON_TYPE).end(JSON.stringify(await stats()));
    return;
  }
  res.writeHead(200, HTML_TYPE).end(PAGE);
}).listen(PORT, HOST, () => console.log(`Watching ${dir} at http://localhost:${PORT}`));
