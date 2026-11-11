# The reader's names, in the order of packages/protocol/src/reader.ts (TurnKind, ReaderSlot). The order is the model's
# output order, so it is written next to the model (labels.json) for the phone to read, never assumed.

BASE_MODEL = "intfloat/multilingual-e5-small"

TURNS = ["greeting", "need", "answer", "market", "other"]
SLOTS = ["kind", "where", "when", "what", "how_long"]

OUTSIDE = "O"
BEGIN = "B-"
INSIDE = "I-"

# One tag per token: outside every detail, or the first or a later token of one detail's words.
TAGS = [OUTSIDE] + [f"{edge}{slot}" for slot in SLOTS for edge in (BEGIN, INSIDE)]
TAG_ID = {tag: i for i, tag in enumerate(TAGS)}
TURN_ID = {turn: i for i, turn in enumerate(TURNS)}

# What the second segment says when no question is open, so "mornings" alone and "mornings" asked for `when` differ.
NO_QUESTION = "none"

# Tokens the loss ignores: the special tokens and the question segment, which carry no tag.
IGNORE = -100

# The work head's class for a message that names no kind of work; the kinds themselves come with the data (works.json,
# from protocol's trades and kinds), so a kind added to GigSync needs a new run's labels and a retrain, nothing here.
NO_WORK = "none"

# A chat message of at most 25 words, and the question, fit in this many tokens with room to spare.
MAX_TOKENS = 96


def labels_json(works):
    """What the phone needs to read the model's outputs."""
    return {
        "works": works,
        "base_model": BASE_MODEL,
        "turns": TURNS,
        "slots": SLOTS,
        "tags": TAGS,
        "no_question": NO_QUESTION,
        "max_tokens": MAX_TOKENS,
    }


def question_text(asking):
    return asking.replace("_", " ") if asking else NO_QUESTION
