# The reader (ADR 0065 §4): the phone's embedding model with three heads, one naming the kind of message and one the kind
# of work from the first token, one tagging every token with its detail. One pass over the message gives all three.
import torch
from torch import nn
from transformers import AutoModel

from .labels import TAGS, TURNS

DROPOUT = 0.1


class Reader(nn.Module):
    def __init__(self, base, works):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(base) if isinstance(base, str) else base
        width = self.encoder.config.hidden_size
        self.dropout = nn.Dropout(DROPOUT)
        self.turn_head = nn.Linear(width, len(TURNS))
        self.tag_head = nn.Linear(width, len(TAGS))
        self.work_head = nn.Linear(width, works)

    def forward(self, input_ids, attention_mask):
        hidden = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        hidden = self.dropout(hidden)
        first = hidden[:, 0]
        return self.turn_head(first), self.tag_head(hidden), self.work_head(first)


class Exported(nn.Module):
    """The reader as the phone runs it: probabilities, not logits, so the app reads confidence straight off."""

    def __init__(self, reader):
        super().__init__()
        self.reader = reader

    def forward(self, input_ids, attention_mask):
        turn, tags, work = self.reader(input_ids, attention_mask)
        return torch.softmax(turn, dim=-1), torch.softmax(tags, dim=-1), torch.softmax(work, dim=-1)
