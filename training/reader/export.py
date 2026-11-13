# Exports a trained reader for the phone (ADR 0065 §4): ONNX, then weights quantized to 8 bits, run on the CPU by
# Transformers.js like the embedding model. Both files are read back over the dev split and must read it as PyTorch
# does, or the export fails:
#   uv run export.py --model ../../data/reader/model-v1 --data ../../data/reader/v1
import argparse
import json
from pathlib import Path

import onnxruntime as ort
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import AutoTokenizer

from reader.labels import BASE_MODEL
from reader.metrics import headline, score
from reader.model import Exported, Reader
from reader.predict import onnx_runner, read_all, torch_runner
from train import CHECKPOINT, LABELS, MARKS, REPORT, splits

ONNX_DIR = "onnx"
FULL = "model.onnx"
QUANTIZED = "model_quantized.onnx"
OPSET = 17
CPU = "CPUExecutionProvider"
# How far the 8-bit file may read the dev split below PyTorch, in points of turn and work accuracy and span F1.
QUANTIZED_SLACK = 0.01
# The full-precision file is the same model: it may differ only by rounding.
FULL_SLACK = 0.002
MB = 1024 * 1024


def args():
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True)
    p.add_argument("--data", required=True, nargs="+")
    return p.parse_args()


def export(model, tokenizer, path):
    sample = tokenizer(["need a plumber tomorrow"], ["none"], return_tensors="pt")
    torch.onnx.export(
        Exported(model),
        (sample["input_ids"], sample["attention_mask"]),
        path,
        input_names=["input_ids", "attention_mask"],
        output_names=["turn_probs", "tag_probs", "work_probs"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "tokens"},
            "attention_mask": {0: "batch", 1: "tokens"},
            "turn_probs": {0: "batch"},
            "tag_probs": {0: "batch", 1: "tokens"},
            "work_probs": {0: "batch"},
        },
        opset_version=OPSET,
        dynamo=False,
    )


def check(name, result, reference, slack):
    for key in ("turn_accuracy", "work_accuracy", "span_f1"):
        if result[key] < reference[key] - slack:
            raise SystemExit(f"{name} reads dev worse than PyTorch on {key}: {result[key]:.4f} < {reference[key]:.4f}")


def main():
    a = args()
    model_dir = Path(a.model)
    out = model_dir / ONNX_DIR
    out.mkdir(exist_ok=True)
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    works = json.loads((model_dir / LABELS).read_text())["works"]
    model = Reader(BASE_MODEL, len(works))
    model.load_state_dict(torch.load(model_dir / CHECKPOINT, map_location="cpu"))
    model.eval()
    _, dev, _, _ = splits(a.data)

    reference = score(dev, read_all(tokenizer, dev, torch_runner(model, torch.device("cpu")), works))
    print(f"pytorch:   {headline(reference)}", flush=True)
    export(model, tokenizer, out / FULL)
    quantize_dynamic(out / FULL, out / QUANTIZED, weight_type=QuantType.QInt8)

    results = {"pytorch": reference}
    for name, slack in ((FULL, FULL_SLACK), (QUANTIZED, QUANTIZED_SLACK)):
        session = ort.InferenceSession(str(out / name), providers=[CPU])
        result = score(dev, read_all(tokenizer, dev, onnx_runner(session), works))
        print(f"{name}: {headline(result)} ({(out / name).stat().st_size / MB:.0f} MB)", flush=True)
        check(name, result, reference, slack)
        results[name] = result

    report_path = model_dir / REPORT
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    report["export"] = {
        name: {k: results[name][k] for k in MARKS} for name in results
    } | {"quantized_mb": round((out / QUANTIZED).stat().st_size / MB, 1)}
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(f"exported to {out}", flush=True)


if __name__ == "__main__":
    main()
