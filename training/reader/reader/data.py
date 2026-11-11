# The generator's examples (scripts/reader-data, ADR 0065 §5) as model inputs: the message and the open question as a
# pair of segments, a turn per message and a tag per message token, read from the character spans by the tokenizer's
# offsets. Spans back from tags go the same way, so training and reading agree on what a token covers.
import json
from pathlib import Path

import torch

from .labels import BEGIN, IGNORE, INSIDE, MAX_TOKENS, OUTSIDE, SLOTS, TAG_ID, TAGS, TURN_ID, question_text

MESSAGE_SEGMENT = 0


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]


def encode(tokenizer, texts, askings):
    return tokenizer(
        texts,
        [question_text(a) for a in askings],
        truncation="only_first",
        max_length=MAX_TOKENS,
        padding=True,
        return_offsets_mapping=True,
        return_tensors="pt",
    )


def _covers(token, span):
    start, end = token
    return start < span["end"] and end > span["start"]


def token_tags(offsets, segments, spans):
    """One tag id per token: the first token inside a span begins it, later ones continue it."""
    tags = []
    seen = set()
    for (start, end), segment in zip(offsets, segments):
        if segment != MESSAGE_SEGMENT or start == end:
            tags.append(IGNORE)
            continue
        span = next((s for s in spans if _covers((start, end), s)), None)
        if span is None:
            tags.append(TAG_ID[OUTSIDE])
            continue
        key = (span["start"], span["slot"])
        tags.append(TAG_ID[f"{INSIDE if key in seen else BEGIN}{span['slot']}"])
        seen.add(key)
    return tags


def batch(tokenizer, examples):
    """A training batch: input ids, mask, turn ids and tag ids, padded together."""
    enc = encode(tokenizer, [e["text"] for e in examples], [e.get("asking") for e in examples])
    tags = []
    for i, example in enumerate(examples):
        segments = enc.sequence_ids(i)
        tags.append(token_tags(enc["offset_mapping"][i].tolist(), segments, example["spans"]))
    return {
        "input_ids": enc["input_ids"],
        "attention_mask": enc["attention_mask"],
        "turn": torch.tensor([TURN_ID[e["turn"]] for e in examples]),
        "tags": torch.tensor(tags),
    }


# A token can carry the punctuation after a word ("2." is one token). A detail ends with the word; punctuation that is
# a token of its own stays when it is tagged, as the labeller sometimes copies it.
TRAILING = ".,!?;:"


def _word_end(text, start, end):
    """The end of a token without the punctuation stuck to its word."""
    cut = end
    while cut > start and text[cut - 1] in TRAILING:
        cut -= 1
    return cut if any(c.isalnum() for c in text[start:cut]) else end


def _trimmed(text, start, end):
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end


def spans_from_tags(text, offsets, segments, tag_ids, scores=None):
    """Character spans from one message's predicted tags; a lone I- starts a span, as a B- would."""
    spans = []
    current = None
    for i, ((start, end), segment) in enumerate(zip(offsets, segments)):
        if segment != MESSAGE_SEGMENT or start == end:
            continue
        tag = TAGS[tag_ids[i]]
        score = scores[i] if scores is not None else 1.0
        if tag == OUTSIDE:
            current = None
            continue
        slot = tag[len(BEGIN) :]
        end = _word_end(text, start, end)
        if tag.startswith(INSIDE) and current is not None and current["slot"] == slot:
            current["end"] = end
            current["scores"].append(score)
            continue
        current = {"slot": slot, "start": start, "end": end, "scores": [score]}
        spans.append(current)
    out = []
    for s in spans:
        start, end = _trimmed(text, s["start"], s["end"])
        if end > start and s["slot"] in SLOTS:
            out.append({"slot": s["slot"], "start": start, "end": end, "confidence": min(s["scores"])})
    return out
