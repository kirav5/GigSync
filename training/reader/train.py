# Trains the reader on a generator run (ADR 0065 §4-5) and keeps the epoch that reads the dev split best:
#   uv run train.py --data ../../data/reader/v1 --out ../../data/reader/model-v1
# A run still going has no train/dev files yet; then examples.jsonl is split the way the generator splits it (every
# tenth target to dev), so a smoke test reads the same dev examples the finished run will.
import argparse
import json
import math
import random
import time
from pathlib import Path

import torch
from torch import nn
from transformers import AutoTokenizer, get_linear_schedule_with_warmup

from reader.data import batch, read_jsonl, with_works
from reader.labels import BASE_MODEL, IGNORE, labels_json
from reader.metrics import headline, score
from reader.model import Reader
from reader.predict import read_all, torch_runner

DEV_EVERY = 10
WARMUP = 0.06
WEIGHT_DECAY = 0.01
MAX_GRAD_NORM = 1.0
LOG_EVERY = 100
CHECKPOINT = "reader.pt"
LABELS = "labels.json"
MARKS = ("turn_accuracy", "work_accuracy", "span_f1", "exact")
REPORT = "report.json"


def args():
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True, nargs="+", help="one or more generator runs, trained on together")
    p.add_argument("--out", required=True)
    p.add_argument("--epochs", type=int, default=6)
    p.add_argument("--batch", type=int, default=32)
    p.add_argument("--lr", type=float, default=5e-5)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--limit", type=int, default=0, help="train on this many examples at most (smoke tests)")
    return p.parse_args()


def splits(runs):
    """Train and dev of every run together, the work head's classes, and where they came from."""
    train, dev, works, sources = [], [], None, []
    for data in [runs] if isinstance(runs, str) else runs:
        t, d, w, source = _split(data)
        if works is not None and w != works:
            raise SystemExit(f"{data} has other kinds of work than the runs before it: draw its labels again")
        train, dev, works = train + t, dev + d, w
        sources.append(f"{data}: {source}")
    return train, dev, works, "; ".join(sources)


def _split(data):
    """One run's train and dev with each example's kind of work, the head's classes, and where they came from."""
    data = Path(data)
    if (data / "train.jsonl").exists() and (data / "dev.jsonl").exists():
        train, dev, source = read_jsonl(data / "train.jsonl"), read_jsonl(data / "dev.jsonl"), "manifest"
    else:
        kept = read_jsonl(data / "examples.jsonl")
        train = [e for e in kept if e["id"] % DEV_EVERY != 0]
        dev = [e for e in kept if e["id"] % DEV_EVERY == 0]
        source = "examples.jsonl (run not finished)"
    train, works = with_works(train, data)
    dev, _ = with_works(dev, data)
    return train, dev, works, source


def device():
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


def evaluate(model, tokenizer, dev, dev_device, works):
    return score(dev, read_all(tokenizer, dev, torch_runner(model, dev_device), works))


def main():
    a = args()
    random.seed(a.seed)
    torch.manual_seed(a.seed)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    train, dev, works, source = splits(a.data)
    work_id = {w: i for i, w in enumerate(works)}
    if a.limit:
        train = train[: a.limit]
        dev = dev[: max(1, a.limit // DEV_EVERY)]
    dev_device = device()
    print(f"{len(train)} train, {len(dev)} dev from {source}, on {dev_device}", flush=True)

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = Reader(BASE_MODEL, len(works)).to(dev_device)
    steps_per_epoch = math.ceil(len(train) / a.batch)
    total = steps_per_epoch * a.epochs
    no_decay = ("bias", "LayerNorm.weight")
    groups = [
        {"params": [p for n, p in model.named_parameters() if not n.endswith(no_decay)], "weight_decay": WEIGHT_DECAY},
        {"params": [p for n, p in model.named_parameters() if n.endswith(no_decay)], "weight_decay": 0.0},
    ]
    optimizer = torch.optim.AdamW(groups, lr=a.lr)
    schedule = get_linear_schedule_with_warmup(optimizer, int(total * WARMUP), total)
    loss_fn = nn.CrossEntropyLoss(ignore_index=IGNORE)

    best = None
    history = []
    started = time.time()
    for epoch in range(1, a.epochs + 1):
        model.train()
        random.shuffle(train)
        for step in range(steps_per_epoch):
            b = batch(tokenizer, train[step * a.batch : (step + 1) * a.batch], work_id)
            b = {k: v.to(dev_device) for k, v in b.items()}
            turn, tags, work = model(b["input_ids"], b["attention_mask"])
            loss = (
                loss_fn(turn, b["turn"])
                + loss_fn(work, b["work"])
                + loss_fn(tags.reshape(-1, tags.shape[-1]), b["tags"].reshape(-1))
            )
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), MAX_GRAD_NORM)
            optimizer.step()
            schedule.step()
            optimizer.zero_grad()
            if step % LOG_EVERY == 0:
                mins = (time.time() - started) / 60
                print(f"epoch {epoch} step {step}/{steps_per_epoch} loss {loss.item():.4f} ({mins:.1f} min)", flush=True)
        result = evaluate(model, tokenizer, dev, dev_device, works)
        history.append({"epoch": epoch, **{k: result[k] for k in MARKS}})
        print(f"epoch {epoch} dev: {headline(result)}", flush=True)
        mark = (result["turn_accuracy"] + result["work_accuracy"] + result["span_f1"]) / 3
        if best is None or mark > best[0]:
            best = (mark, epoch, result)
            torch.save(model.state_dict(), out / CHECKPOINT)

    tokenizer.save_pretrained(out)
    (out / LABELS).write_text(json.dumps(labels_json(works), indent=2) + "\n")
    report = {
        "data": str(a.data),
        "source": source,
        "train": len(train),
        "dev_examples": len(dev),
        "settings": {k: getattr(a, k) for k in ("epochs", "batch", "lr", "seed", "limit")},
        "best_epoch": best[1],
        "dev": best[2],
        "history": history,
        "minutes": round((time.time() - started) / 60, 1),
    }
    (out / REPORT).write_text(json.dumps(report, indent=2) + "\n")
    print(f"kept epoch {best[1]}: {headline(best[2])}", flush=True)


if __name__ == "__main__":
    main()
