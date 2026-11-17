# Reading examples with a trained reader, in PyTorch or through the exported ONNX file: the same decoding either way, so
# the export is checked against the model it came from.
import numpy as np
import torch

from .data import encode, spans_from_tags
from .labels import TURNS

READ_BATCH = 128


def read_all(tokenizer, examples, run, works):
    """`run(input_ids, attention_mask)` returns (turn, tag, work) probabilities as numpy arrays."""
    out = []
    for at in range(0, len(examples), READ_BATCH):
        chunk = examples[at : at + READ_BATCH]
        enc = encode(tokenizer, [e["text"] for e in chunk], [e.get("asking") for e in chunk])
        turn_p, tag_p, work_p = run(enc["input_ids"].numpy(), enc["attention_mask"].numpy())
        for i, example in enumerate(chunk):
            tag_ids = tag_p[i].argmax(-1)
            scores = tag_p[i].max(-1)
            spans = spans_from_tags(
                example["text"], enc["offset_mapping"][i].tolist(), enc.sequence_ids(i), tag_ids, scores
            )
            out.append(
                {
                    "turn": TURNS[int(turn_p[i].argmax())],
                    "turn_confidence": float(turn_p[i].max()),
                    "work": works[int(work_p[i].argmax())],
                    "work_confidence": float(work_p[i].max()),
                    "spans": spans,
                }
            )
    return out


def torch_runner(model, device):
    model.eval()

    @torch.no_grad()
    def run(input_ids, attention_mask):
        outputs = model(torch.from_numpy(input_ids).to(device), torch.from_numpy(attention_mask).to(device))
        return tuple(torch.softmax(o, -1).float().cpu().numpy() for o in outputs)

    return run


def onnx_runner(session):
    def run(input_ids, attention_mask):
        return session.run(
            None, {"input_ids": input_ids.astype(np.int64), "attention_mask": attention_mask.astype(np.int64)}
        )

    return run
