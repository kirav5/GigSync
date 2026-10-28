// Writes docs/gigsync/i18n-review.md: every string in English, Hindi and Kannada side by side, with an empty column for
// a native-speaking organiser's verdict. Reads the built catalogs, so run `pnpm --filter @gigsync/core build` first.
// Run with `pnpm i18n:sheet` after changing any string; the sheet is what a reviewer signs off before the pilot.
import { writeFileSync } from "node:fs";

const AREAS = ["job", "screens", "worker", "agent", "shell", "money", "speech", "interview", "home", "install"];
const OUT = new URL("../docs/gigsync/i18n-review.md", import.meta.url);
const core = new URL("../packages/core/dist/i18n/", import.meta.url);

const load = async (lang, area) => (await import(new URL(`${lang}/${area}.js`, core).href))[area];
const cell = (s) => s.replaceAll("|", "\\|");

const parts = [
  "# Hindi and Kannada strings: native-speaker review",
  "",
  "Every string the app shows, in English, Hindi and Kannada. The team wrote the Hindi and Kannada; a model then",
  "reviewed them. Neither is a native speaker. Before the pilot a native-speaking organiser marks each row **ok** or",
  "writes the better wording in the last column. `{name}` parts are filled in by the app (a price, a name, a",
  "language) and must stay as they are. Regenerate with `pnpm i18n:sheet` after any change.",
];
let total = 0;
for (const area of AREAS) {
  const [en, hi, kn] = await Promise.all(["en", "hi", "kn"].map((l) => load(l, area)));
  parts.push("", `## ${area}`, "", "| Key | English | Hindi | Kannada | Reviewer |", "| --- | --- | --- | --- | --- |");
  for (const key of Object.keys(en)) {
    parts.push(`| \`${key}\` | ${cell(en[key])} | ${cell(hi[key])} | ${cell(kn[key])} | |`);
    total++;
  }
}
writeFileSync(OUT, `${parts.join("\n")}\n`);
console.log(`wrote ${total} strings to docs/gigsync/i18n-review.md`);
