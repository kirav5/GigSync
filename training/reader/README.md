# Training the reader

The phone's reader (ADR 0065) is `multilingual-e5-small` with three heads: one names the kind of message, one the kind
of work (a trade or a kind from protocol, or `none`), and one tags each token of the message with its detail (`kind`,
`where`, `when`, `what`, `how_long`). The kind of work is learned, not looked up by meaning: "my TV won't turn on" is
TV repair, which a nearest-saying match takes for an electrician. A trade or kind added to GigSync therefore needs a
new run's labels and a retrain. It learns from a run of the data
generator (`pnpm reader:data`, `scripts/reader-data/`) and is exported to ONNX with 8-bit weights for Transformers.js.

This is the repo's only Python. It runs on a founder's Mac, never in CI. It needs [uv](https://docs.astral.sh/uv/)
(`brew install uv`), which brings its own Python 3.12 and the packages in `pyproject.toml`.

```bash
pnpm reader:train          # trains on data/reader/v1, exports to data/reader/model-v1
```

or step by step, from this folder:

```bash
uv run train.py --data ../../data/reader/v1 --out ../../data/reader/model-v1
uv run export.py --model ../../data/reader/model-v1 --data ../../data/reader/v1
```

Each example's kind of work is not in the generator's files: `scripts/reader-data/works.mjs` draws every kept example's
target again from the run's seed and writes `works.json` and `works.jsonl` beside them (`pnpm reader:train` and the
watcher run it first). A run still going has no `train.jsonl` yet: `train.py` then splits `examples.jsonl` as the generator will (every
tenth target to dev), and `--limit 2000 --epochs 1` makes a quick smoke test.

To train as soon as an unattended run finishes, leave a watcher going next to it:

```bash
nohup caffeinate -i training/reader/after-run.sh data/reader/v1 data/reader/model-v1 >> data/reader/train.log 2>&1 &
```

It trains only when the run's manifest counts every target; `data/reader/model-v1/STATUS` says `training`, `done` or
`failed`.

## What comes out

`data/reader/model-v1/`, kept on the machine like the data:

| File                        | What                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `reader.pt`                 | The best epoch's weights, by turn accuracy and span F1 on dev              |
| `onnx/model_quantized.onnx` | What the phone runs: inputs `input_ids`, `attention_mask`                  |
| `onnx/model.onnx`           | The same at full precision                                                 |
| `labels.json`               | The order of the turn, work and tag outputs, and the empty question's word |
| tokenizer files             | The base model's tokenizer, unchanged                                      |
| `report.json`               | Settings, dev scores per epoch and per detail, and the export's check      |

The input is a pair: the message, then the detail the open question asks for (`how long`, or `none`). The outputs are
probabilities: `turn_probs` (one row per message, in `labels.json` `turns` order), `work_probs` (one row per message,
in `works` order) and `tag_probs` (one row per token,
in `tags` order: `O`, then `B-` and `I-` per detail). A detail's words run from a `B-` token through the `I-` tokens of
the same detail, by the tokenizer's character offsets.

Dev scores come from the teacher's own data, so they say the model learned the teacher; whether it reads people is
the gate's held-out test set (ADR 0065, step 5).

## Putting it in the app

The phone app comes with its models (ADR 0065, amendment of 2026-11-15). Trim the reader and the embedding model to
the pieces the phone reads, in one run so both keep the same pieces, keeping the eval sets out of the corpus:

```bash
uv run trim.py --tokenizer ../../data/reader/model-v6 --top 20000 \
  --corpus ../../packages ../../apps/mobile/src ../../data/reader/v1 ../../data/reader/hinglish-v1 \
  --model ../../data/reader/model-v6 ../../data/reader/model-v6-trim \
  --model <Transformers.js cache>/Xenova/multilingual-e5-small ../../data/reader/e5-small-trim
```

Score the trimmed pair as phones read it (copy `e5-small-trim` into Transformers.js's cache as `gigsync/e5-small-trim`
for `EMBEDDING_MODEL` to find it), then put both in a native build:

```bash
READER_MODEL=data/reader/model-v6-trim EMBEDDING_MODEL=gigsync/e5-small-trim pnpm eval:find --reader phone --offline --set hinglish-held
pnpm build && pnpm models:bundle --embedder data/reader/e5-small-trim --reader data/reader/model-v6-trim
pnpm --filter @gigsync/mobile exec cap sync android
```

## Putting it on the web

The website reads with the same bundle as the phone (ADR 0065, amendment of 2026-11-16). Write the bundle alone, a
folder per version, and put it on GigSync's model host, an R2 bucket, where a version is never overwritten:

```bash
pnpm models:bundle --embedder data/reader/e5-small-trim --reader data/reader/model-v6-trim --out data/models/v6
pnpm models:publish --bundle data/models/v6 --version v6 --dry-run   # checks the manifest and lists the files
pnpm models:publish --bundle data/models/v6 --version v6             # needs `wrangler login`
```

The website's build reads it from `VITE_MODELS_URL` (the `MODELS_URL` repository variable in CI), e.g.
`https://models.gigsync.network/v6/`. The bucket answers the app's origins with CORS (`infra/r2/models-cors.json`:
`wrangler r2 bucket cors set gigsync-models --file infra/r2/models-cors.json`).

To try the web app with the bundle locally, serve the folder with CORS and point the dev server at it; the same
folder is what to give anyone else who tries it:

```bash
pnpm models:serve        # data/models on http://localhost:8791
VITE_MODELS_URL=http://localhost:8791/v6/ pnpm --filter @gigsync/mobile exec vite --port 5174
```

Before publishing, score it the way phones read, with and without GigSync's model:

```bash
READER_MODEL=data/reader/model-v3 pnpm eval:find --reader phone --set en --offline
```
