# Training the reader

The phone's reader (ADR 0065) is `multilingual-e5-small` with two heads: one names the kind of message, one tags each
token of the message with its detail (`kind`, `where`, `when`, `what`, `how_long`). It learns from a run of the data
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

A run still going has no `train.jsonl` yet: `train.py` then splits `examples.jsonl` as the generator will (every
tenth target to dev), and `--limit 2000 --epochs 1` makes a quick smoke test.

To train as soon as an unattended run finishes, leave a watcher going next to it:

```bash
nohup caffeinate -i training/reader/after-run.sh data/reader/v1 data/reader/model-v1 >> data/reader/train.log 2>&1 &
```

It trains only when the run's manifest counts every target; `data/reader/model-v1/STATUS` says `training`, `done` or
`failed`.

## What comes out

`data/reader/model-v1/`, kept on the machine like the data:

| File                        | What                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| `reader.pt`                 | The best epoch's weights, by turn accuracy and span F1 on dev         |
| `onnx/model_quantized.onnx` | What the phone runs: inputs `input_ids`, `attention_mask`             |
| `onnx/model.onnx`           | The same at full precision                                            |
| `labels.json`               | The order of the turn and tag outputs, and the empty question's word  |
| tokenizer files             | The base model's tokenizer, unchanged                                 |
| `report.json`               | Settings, dev scores per epoch and per detail, and the export's check |

The input is a pair: the message, then the detail the open question asks for (`how long`, or `none`). The outputs are
probabilities: `turn_probs` (one row per message, in `labels.json` `turns` order) and `tag_probs` (one row per token,
in `tags` order: `O`, then `B-` and `I-` per detail). A detail's words run from a `B-` token through the `I-` tokens of
the same detail, by the tokenizer's character offsets.

Dev scores come from the teacher's own data, so they say the model learned the teacher; whether it reads people is
the gate's held-out test set (ADR 0065, step 5).
