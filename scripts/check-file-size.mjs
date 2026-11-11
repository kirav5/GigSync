// Fails when a tracked source file reaches 300 lines. Runs as part of `pnpm lint`, so CI enforces it.
// Split a growing file by responsibility well before the limit; see .claude/skills/code-quality.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_LINES = 299;
const SOURCE = /\.(ts|tsx|js|mjs|cjs|sql|kt|swift|java|py|sh)$/;

const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\0")
  .filter((f) => SOURCE.test(f));

const tooLong = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // deleted in the working tree but still in the index
  }
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  if (lines > MAX_LINES) tooLong.push(`  ${file}: ${lines} lines`);
}

if (tooLong.length > 0) {
  console.error(`Files must stay under 300 lines; split these by responsibility:\n${tooLong.join("\n")}`);
  process.exit(1);
}
