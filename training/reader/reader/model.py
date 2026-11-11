# The reader (ADR 0065 §4): the phone's embedding model with two heads, one naming the kind of message from the first
# token, one tagging every token with its detail. One pass over the message gives both.
import torch
from torch import nn
from transformers import AutoModel

from .labels import TAGS, TURNS

DROPOUT = 0.1


class Reader(nn.Module):
    def __init__(self, base):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(base) if isinstance(base, str) else base
        width = self.encoder.config.hidden_size
        self.dropout = nn.Dropout(DROPOUT)
        self.turn_head = nn.Linear(width, len(TURNS))
        self.tag_head = nn.Linear(width, len(TAGS))

    def forward(self, input_ids, attention_mask):
        hidden = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        hidden = self.dropout(hidden)
        return self.turn_head(hidden[:, 0]), self.tag_head(hidden)


class Exported(nn.Module):
    """The reader as the phone runs it: probabilities, not logits, so the app reads confidence straight off."""

    def __init__(self, reader):
        super().__init__()
        self.reader = reader

    def forward(self, input_ids, attention_mask):
        turn, tags = self.reader(input_ids, attention_mask)
        return torch.softmax(turn, dim=-1), torch.softmax(tags, dim=-1)
