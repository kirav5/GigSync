# Reading examples with a trained reader, in PyTorch or through the exported ONNX file: the same decoding either way, so
# the export is checked against the model it came from.
import numpy as np
import torch

from .data import encode, spans_from_tags
from .labels import TURNS

READ_BATCH = 128


def read_all(tokenizer, examples, run):
    """`run(input_ids, attention_mask)` returns (turn probabilities, tag probabilities) as numpy arrays."""
    out = []
    for at in range(0, len(examples), READ_BATCH):
        chunk = examples[at : at + READ_BATCH]
        enc = encode(tokenizer, [e["text"] for e in chunk], [e.get("asking") for e in chunk])
        turn_p, tag_p = run(enc["input_ids"].numpy(), enc["attention_mask"].numpy())
        for i, example in enumerate(chunk):
            tag_ids = tag_p[i].argmax(-1)
            scores = tag_p[i].max(-1)
            spans = spans_from_tags(
                example["text"], enc["offset_mapping"][i].tolist(), enc.sequence_ids(i), tag_ids, scores
            )
            out.append(
                {"turn": TURNS[int(turn_p[i].argmax())], "turn_confidence": float(turn_p[i].max()), "spans": spans}
            )
    return out


def torch_runner(model, device):
    model.eval()

    @torch.no_grad()
    def run(input_ids, attention_mask):
        turn, tags = model(torch.from_numpy(input_ids).to(device), torch.from_numpy(attention_mask).to(device))
        return torch.softmax(turn, -1).float().cpu().numpy(), torch.softmax(tags, -1).float().cpu().numpy()

    return run


def onnx_runner(session):
    def run(input_ids, attention_mask):
        turn, tags = session.run(
            None, {"input_ids": input_ids.astype(np.int64), "attention_mask": attention_mask.astype(np.int64)}
        )
        return turn, tags

    return run
