# Trims the vocabulary of the phone's two models (ADR 0065): the understanding pack's embedding model and the reader
# share one tokenizer of 250,000 pieces for about a hundred languages, and its table is 85% of each 8-bit file. The
# phone reads English, Hinglish, Hindi and Kannada, so only the pieces those need are kept: every piece of the
# Devanagari and Kannada scripts, every single letter, digit and symbol, every piece a corpus of the app's own words
# uses, and the most likely pieces of the Latin script. A word whose piece was dropped is split into smaller kept
# pieces, as the tokenizer splits any rare word; a message made only of kept pieces reads exactly as before. Both
# models are trimmed with the same pieces, so the reader keeps using the embedding model's tokenizer:
#   uv run trim.py --tokenizer ../../data/reader/model-v6 --corpus ../../packages ../../data/reader/v1 \
#     --model ../../data/reader/model-v6 ../../data/reader/model-v6-trim --model <e5 dir> <e5 trimmed dir>
import argparse
import json
import shutil
import unicodedata
from pathlib import Path

import numpy as np
import onnx
from onnx import numpy_helper
from tokenizers import Tokenizer

TOKENIZER = "tokenizer.json"
TOKENIZER_CONFIG = "tokenizer_config.json"
CONFIG = "config.json"
ONNX_DIR = "onnx"
TRIM = "trim.json"
WORD_TABLE = "word_embeddings.weight"
QUANTIZED = "_quantized"
SCALE = "_scale"
SPACE = "▁"
# Scripts the phone reads besides Latin: Devanagari (Hindi) and Kannada, kept whole.
INDIC = ((0x0900, 0x097F), (0x0C80, 0x0CFF))
# Latin letters with marks (café, naïve) come with the Latin pieces.
LATIN_END = 0x0250
# Text files read for the pieces the app's own words use; jsonl rows give their "text" or "message".
CORPUS_SUFFIXES = {".ts", ".tsx", ".mjs", ".json", ".md"}
JSONL = ".jsonl"
TEXT_FIELDS = ("text", "message")
# Files copied with a model unchanged.
COPIED = ("labels.json", "special_tokens_map.json")


def args():
    p = argparse.ArgumentParser()
    p.add_argument("--tokenizer", required=True, help="a folder with the shared tokenizer.json")
    p.add_argument("--corpus", nargs="+", default=[], help="files or folders of the app's own words")
    p.add_argument("--top", type=int, default=20000, help="how many of the likeliest Latin pieces to keep")
    p.add_argument("--model", nargs=2, action="append", default=[], metavar=("IN", "OUT"))
    return p.parse_args()


def indic(ch):
    return any(lo <= ord(ch) <= hi for lo, hi in INDIC)


def latin(ch):
    return ord(ch) < LATIN_END


def symbol(ch):
    return unicodedata.category(ch)[0] in "PSNZ"


def corpus_lines(paths):
    for root in map(Path, paths):
        files = [root] if root.is_file() else sorted(p for p in root.rglob("*") if p.is_file())
        for f in files:
            if "node_modules" in f.parts:
                continue
            if f.suffix == JSONL:
                for line in f.read_text(errors="ignore").splitlines():
                    row = json.loads(line) if line.strip() else {}
                    yield from (row[k] for k in TEXT_FIELDS if isinstance(row.get(k), str))
            elif f.suffix in CORPUS_SUFFIXES:
                yield from f.read_text(errors="ignore").splitlines()


def kept_ids(tokenizer_path, corpus, top):
    """The old ids kept, in order: specials, then pieces by the rules above."""
    tok = json.loads(tokenizer_path.read_text())
    vocab = tok["model"]["vocab"]
    specials = {a["id"] for a in tok["added_tokens"]}
    keep = set(specials)
    likely = []
    for i, (piece, score) in enumerate(vocab):
        text = piece.replace(SPACE, "")
        if len(text) <= 1 and (not text or latin(text) or indic(text) or symbol(text)):
            keep.add(i)
        elif text and all(indic(ch) or symbol(ch) for ch in text) and any(indic(ch) for ch in text):
            keep.add(i)
        elif text and all(latin(ch) for ch in text):
            likely.append((score, i))
    keep.update(i for _, i in sorted(likely, reverse=True)[:top])
    full = Tokenizer.from_file(str(tokenizer_path))
    for line in corpus_lines(corpus):
        keep.update(full.encode(line, add_special_tokens=False).ids)
    return sorted(keep)


def trim_tokenizer(src, dst, ids):
    new_id = {old: new for new, old in enumerate(ids)}
    tok = json.loads((src / TOKENIZER).read_text())
    tok["model"]["vocab"] = [tok["model"]["vocab"][i] for i in ids]
    tok["model"]["unk_id"] = new_id[tok["model"]["unk_id"]]
    for a in tok["added_tokens"]:
        a["id"] = new_id[a["id"]]
    for special in tok["post_processor"].get("special_tokens", {}).values():
        special["ids"] = [new_id[i] for i in special["ids"]]
    (dst / TOKENIZER).write_text(json.dumps(tok, ensure_ascii=False))
    config_path = src / TOKENIZER_CONFIG
    if config_path.exists():
        config = json.loads(config_path.read_text())
        added = config.get("added_tokens_decoder", {})
        config["added_tokens_decoder"] = {str(new_id[int(k)]): v for k, v in added.items()}
        (dst / TOKENIZER_CONFIG).write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n")


def trim_onnx(src, dst, ids):
    """Keeps the rows of the word table for the kept pieces, in their new order; the rest of the model is unchanged."""
    model = onnx.load(str(src))
    inits = model.graph.initializer
    tables = [t for t in inits if t.name.endswith(WORD_TABLE) or t.name.endswith(WORD_TABLE + QUANTIZED)]
    if len(tables) != 1:
        raise SystemExit(f"{src}: expected one word table, found {len(tables)}")
    table = tables[0]
    # An 8-bit table has one scale for every row, so keeping rows keeps their values; a scale per row would not.
    scales = [t for t in inits if t.name.endswith(WORD_TABLE + SCALE)]
    if any(np.prod(t.dims) != 1 for t in scales):
        raise SystemExit(f"{src}: the word table has a scale per row")
    rows = numpy_helper.to_array(table)[np.array(ids)]
    table.CopyFrom(numpy_helper.from_array(rows, table.name))
    onnx.save(model, str(dst))


def trim_model(src, dst, ids):
    dst.mkdir(parents=True, exist_ok=True)
    if (src / TOKENIZER).exists():
        trim_tokenizer(src, dst, ids)
    for name in COPIED:
        if (src / name).exists():
            shutil.copy(src / name, dst / name)
    if (src / CONFIG).exists():
        config = json.loads((src / CONFIG).read_text())
        config["vocab_size"] = len(ids)
        (dst / CONFIG).write_text(json.dumps(config, indent=2) + "\n")
    (dst / ONNX_DIR).mkdir(exist_ok=True)
    for f in sorted((src / ONNX_DIR).glob("*.onnx")):
        trim_onnx(f, dst / ONNX_DIR / f.name, ids)
        print(f"{dst / ONNX_DIR / f.name}: {(dst / ONNX_DIR / f.name).stat().st_size / 2**20:.1f} MB", flush=True)


def main():
    a = args()
    ids = kept_ids(Path(a.tokenizer) / TOKENIZER, a.corpus, a.top)
    print(f"keeping {len(ids)} pieces", flush=True)
    for src, dst in a.model:
        trim_model(Path(src), Path(dst), ids)
        (Path(dst) / TRIM).write_text(json.dumps({"pieces": len(ids), "top": a.top, "kept": ids}) + "\n")


if __name__ == "__main__":
    main()
