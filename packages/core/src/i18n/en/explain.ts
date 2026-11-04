/**
 * Why an offer is what it is (ADR 0033 §4), one sentence per fact, shown to the owner under each offer in the agents'
 * talk. A model may word the same facts; when any number it writes is not one of them, these sentences are used.
 */
export const explain = {
  "explain.opened_mine": "Your agent opened at {price}.",
  "explain.opened_theirs": "{name} opened at {price}.",
  "explain.down_mine": "Your agent came down {delta}, to {price}.",
  "explain.down_theirs": "{name} came down {delta}, to {price}.",
  "explain.up_mine": "Your agent came up {delta}, to {price}.",
  "explain.up_theirs": "{name} came up {delta}, to {price}.",
  "explain.held_mine": "Your agent kept the price at {price}.",
  "explain.held_theirs": "{name} kept the price at {price}.",
  "explain.terms_mine": "Your agent proposed {terms}.",
  "explain.terms_theirs": "{name} proposed {terms}.",
  "explain.usual_jobs.one": "The usual rate is {typical} ({low}–{high}, from {count} job on GigSync).",
  "explain.usual_jobs.other": "The usual rate is {typical} ({low}–{high}, from {count} jobs on GigSync).",
  "explain.usual_range": "The usual range is {low}–{high}.",
  "explain.limit_within": "That is inside your limit of {limit}.",
  "explain.limit_outside": "That is {gap} past your limit of {limit}.",
  "explain.label": "Why this offer",
} as const;
