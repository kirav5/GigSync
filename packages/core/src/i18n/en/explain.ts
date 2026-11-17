/**
 * Why an offer is what it is (ADR 0033 §4), one sentence per fact, shown to the owner under each offer in the agents'
 * talk. A model may word the same facts; when any number it writes is not one of them, these sentences are used.
 */
export const explain = {
  "explain.opened_mine": "Your assistant opened at {price}.",
  "explain.opened_theirs": "{name} opened at {price}.",
  "explain.down_mine": "Your assistant came down {delta}, to {price}.",
  "explain.down_theirs": "{name} came down {delta}, to {price}.",
  "explain.up_mine": "Your assistant came up {delta}, to {price}.",
  "explain.up_theirs": "{name} came up {delta}, to {price}.",
  "explain.held_mine": "Your assistant kept the price at {price}.",
  "explain.held_theirs": "{name} kept the price at {price}.",
  "explain.terms_mine": "Your assistant proposed {terms}.",
  "explain.terms_theirs": "{name} proposed {terms}.",
  "explain.usual_jobs.one": "The usual rate is {typical} ({low}–{high}, from {count} job on GigSync).",
  "explain.usual_jobs.other": "The usual rate is {typical} ({low}–{high}, from {count} jobs on GigSync).",
  "explain.usual_range": "The usual range is {low}–{high}.",
  "explain.limit.provider.above": "That is {gap} above your lowest price of {limit}.",
  "explain.limit.provider.below": "That is {gap} below your lowest price of {limit}.",
  "explain.limit.provider.at": "That is exactly your lowest price of {limit}.",
  "explain.limit.requester.above": "That is {gap} over your budget of {limit}.",
  "explain.limit.requester.below": "That is {gap} under your budget of {limit}.",
  "explain.limit.requester.at": "That is exactly your budget of {limit}.",
  "explain.label": "Why this offer",
} as const;
