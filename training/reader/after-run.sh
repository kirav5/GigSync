#!/bin/sh
# Trains and exports the reader as soon as a generator run finishes, for a run left going unattended (ADR 0065 §5):
#   nohup caffeinate -i training/reader/after-run.sh data/reader/v1 data/reader/model-v1 >> data/reader/train.log 2>&1 &
# Runs named after the model folder are trained on too, the waited-for run first:
#   training/reader/after-run.sh data/reader/v1-problems data/reader/model-v3 data/reader/v1
# It waits while `scripts/reader-data.mjs` is running, then trains only if the run wrote its manifest for every target
# it set out to make; a run that stopped early is left for a person to resume. caffeinate keeps the Mac awake through
# the wait and the training, as the generator's own caffeinate ends with it.
set -eu

DATA=$(cd "$1" && pwd)
OUT=$2
shift 2
MORE=""
for run in "$@"; do MORE="$MORE $(cd "$run" && pwd)"; done
CHECK_EVERY_S=60
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)

say() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

say "waiting for the run in $DATA to finish"
while pgrep -f "scripts/reader-data.mjs" > /dev/null; do sleep "$CHECK_EVERY_S"; done

# The run is done when its manifest counts as many targets as run.json asked for.
if ! node -e '
  const fs = require("node:fs");
  const [dir] = process.argv.slice(1);
  const run = JSON.parse(fs.readFileSync(`${dir}/run.json`, "utf8"));
  const manifest = fs.existsSync(`${dir}/manifest.json`) && JSON.parse(fs.readFileSync(`${dir}/manifest.json`, "utf8"));
  process.exit(manifest && manifest.targets >= run.count ? 0 : 1);
' "$DATA"; then
  say "the run stopped before finishing: no training. Resume it, then run this again."
  echo failed > "$OUT/STATUS"
  exit 1
fi

say "run finished; training into $OUT"
echo training > "$OUT/STATUS"
for run in "$DATA" $MORE; do node "$HERE/../../scripts/reader-data/works.mjs" --out "$run"; done
cd "$HERE"
# shellcheck disable=SC2086 # MORE is a list of paths without spaces, split on purpose
if uv run train.py --data "$DATA" $MORE --out "$OUT" && uv run export.py --model "$OUT" --data "$DATA" $MORE; then
  echo done > "$OUT/STATUS"
  say "trained and exported: $OUT/report.json"
else
  echo failed > "$OUT/STATUS"
  say "training or export failed; see above"
  exit 1
fi
