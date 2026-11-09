// The production run's report page: summary.json (from prod-report.mjs), each kind's chats and questions, four
// screenshots per kind made small, and the model log beside it. Writes prod-runs/<run>/report/ for publishing.
// Run with `node prod-report-html.mjs <run id> <findings.json>` from tests/ui after prod-report.mjs.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { groupOf } from "../../packages/protocol/dist/index.js";

const run = process.argv[2] ?? "all-62";
const findingsFile = process.argv[3];
const dir = new URL(`./prod-runs/${run}/`, import.meta.url).pathname;
const out = `${dir}report/`;
mkdirSync(`${out}shots`, { recursive: true });
const summary = JSON.parse(readFileSync(`${dir}summary.json`, "utf8"));
const findings = findingsFile ? JSON.parse(readFileSync(findingsFile, "utf8")) : [];

/** The four views that tell a kind's story, or the stop screens when it stopped. */
const WANTED = [
  "1-worker-card-chat",
  "3-customer-find-chat",
  "5-customer-job",
  "6-worker-job",
  "x-worker-at-stop",
  "x-customer-at-stop",
];
for (const k of summary.kinds_detail) {
  k.group = groupOf(k.kind);
  k.images = [];
  for (const name of WANTED) {
    const src = `${dir}${k.kind}/${name}.png`;
    if (!existsSync(src)) continue;
    const file = `shots/${k.kind}-${name}.jpg`;
    execFileSync(
      "sips",
      ["-s", "format", "jpeg", "-s", "formatOptions", "55", "--resampleWidth", "360", src, "--out", `${out}${file}`],
      {
        stdio: "ignore",
      },
    );
    k.images.push({ name, file });
  }
  delete k.shots;
}
copyFileSync(`${dir}model-calls.jsonl`, `${out}model-calls.jsonl`);
const data = JSON.stringify({ ...summary, findings }).replace(/</g, "\\u003c");
const template = readFileSync(new URL("./prod-report-page.html", import.meta.url), "utf8");
writeFileSync(`${out}index.html`, template.replace("__DATA__", data));
console.log(`wrote ${out}index.html with ${summary.kinds_detail.reduce((s, k) => s + k.images.length, 0)} screenshots`);
