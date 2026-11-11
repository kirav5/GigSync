# How well the reader reads held-out examples: the kind of message, and each detail's words exactly (a span counts only
# when its slot, start and end all match, as the code after the reader needs the words, not roughly where they are).
from .labels import NO_WORK, SLOTS, TURNS


def _key(span):
    return (span["slot"], span["start"], span["end"])


def score(examples, predictions):
    """`predictions` are `{turn, spans}` in the order of `examples`."""
    turn_right = 0
    all_right = 0
    work_right = 0
    named = 0
    named_right = 0
    counts = {slot: {"tp": 0, "fp": 0, "fn": 0} for slot in SLOTS}
    confusion = {t: {u: 0 for u in TURNS} for t in TURNS}
    for example, predicted in zip(examples, predictions):
        confusion[example["turn"]][predicted["turn"]] += 1
        turn_ok = example["turn"] == predicted["turn"]
        turn_right += turn_ok
        work_ok = example.get("work") == predicted.get("work")
        work_right += work_ok
        if example.get("work", NO_WORK) != NO_WORK:
            named += 1
            named_right += work_ok
        gold = {_key(s) for s in example["spans"]}
        got = {_key(s) for s in predicted["spans"]}
        all_right += turn_ok and gold == got
        for slot in SLOTS:
            g = {k for k in gold if k[0] == slot}
            p = {k for k in got if k[0] == slot}
            counts[slot]["tp"] += len(g & p)
            counts[slot]["fp"] += len(p - g)
            counts[slot]["fn"] += len(g - p)
    n = max(1, len(examples))
    slots = {slot: _f1(c) for slot, c in counts.items()}
    span_f1 = sum(s["f1"] for s in slots.values()) / len(slots)
    return {
        "examples": len(examples),
        "turn_accuracy": turn_right / n,
        "work_accuracy": work_right / n,
        "work_named_accuracy": named_right / max(1, named),
        "span_f1": span_f1,
        "exact": all_right / n,
        "slots": slots,
        "turn_confusion": confusion,
    }


def _f1(c):
    precision = c["tp"] / (c["tp"] + c["fp"]) if c["tp"] + c["fp"] else 0.0
    recall = c["tp"] / (c["tp"] + c["fn"]) if c["tp"] + c["fn"] else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": precision, "recall": recall, "f1": f1, "support": c["tp"] + c["fn"]}


def headline(result):
    slots = " ".join(f"{s}={v['f1']:.3f}" for s, v in result["slots"].items())
    work = f"work={result['work_accuracy']:.3f} (named {result['work_named_accuracy']:.3f})"
    return f"turn={result['turn_accuracy']:.3f} {work} span_f1={result['span_f1']:.3f} exact={result['exact']:.3f} | {slots}"
