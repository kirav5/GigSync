// What the conversations are scored on: what the first real tests of Find showed going wrong.

const SAME_QUESTION = 0.75;
const NOT_WORD = /[\s,.?!।|…:;"'()]+/u;
const words = (text) =>
  new Set(
    text
      .toLowerCase()
      .split(NOT_WORD)
      .filter((w) => w.length > 2),
  );

/** Two questions in a row, or any two, that ask the same thing. */
export function repeatsIn(asked) {
  let count = 0;
  asked.forEach((q, i) => {
    const now = words(q);
    const again = asked.slice(0, i).some((before) => {
      const seen = words(before);
      const shorter = Math.min(now.size, seen.size);
      return shorter > 0 && [...now].filter((w) => seen.has(w)).length / shorter >= SAME_QUESTION;
    });
    if (again) count++;
  });
  return count;
}

/** Right work: the trade wanted, or, for work outside the trades, some job named and no trade forced on it. */
export const rightJob = (want, job) => ("trade" in want ? job?.trade === want.trade : Boolean(job && "outside" in job));

const percent = (part, whole) => (whole === 0 ? "-" : `${Math.round((part / whole) * 100)}%`);

/** One line of numbers for a group of runs. */
export function line(label, runs) {
  const n = runs.length;
  const right = runs.filter((r) => rightJob(r.want, r.job)).length;
  const clean = runs.filter((r) => repeatsIn(r.asked) === 0).length;
  const noSorry = runs.filter((r) => r.sorries === 0).length;
  const ended = runs.filter((r) => r.end === "ready").length;
  const dead = runs.filter((r) => r.end !== "ready").length;
  const offered = runs.filter((r) => r.later && r.switched).length;
  const later = runs.filter((r) => r.later).length;
  const questions = runs.reduce((sum, r) => sum + r.asked.length, 0) / (n || 1);
  return `${label.padEnd(10)} n=${String(n).padEnd(4)} right job ${percent(right, n).padStart(4)} | no repeats ${percent(clean, n).padStart(4)} | no "Sorry" ${percent(noSorry, n).padStart(4)} | reached the readback ${percent(ended, n).padStart(4)} (${dead} did not) | questions ${questions.toFixed(1)}${later ? ` | offered a switch ${percent(offered, later)}` : ""}`;
}
