/**
 * Skills outside the trades (ADR 0047): a worker lists work in their own words, a household asks for it, and the
 * generic questions such work gets. There is no estimate for such work, and the copy says so.
 */
export const skill = {
  "trade.other": "Other work",
  "question.job": "What exactly is the work?",
  "detail.job": "the work",
  "question.duration": "About how long will it take?",
  "detail.duration": "how long it takes",
  "skill.err.length": "Name the work in 2 to 40 letters.",
  "skill.err.words": "Name the work in a few words, like “Tailor” or “Garden work”.",
  "skill.err.characters": "Use only letters for the work: no numbers, links or contact details.",
  "skill.err.blocked": "That work cannot be listed on GigSync.",
  "skill.err.too_many": "A card lists up to {max} kinds of work.",
  "skill.is_trade": "That is {trade}: it is on the list, with its prices.",
  "skill.is_work": "Is this {work}?",
  "card.skill_label": "Other work, in your own words",
  "card.skill_example": "Tailor",
  "card.skill_add": "Add",
  "card.skill_remove": "Remove {skill}",
  "iv.skill_kept": "I will list it as “{skill}”.",
  "need.skill_found": "Workers near you list “{skill}”.",
  "need.pick_work": "Pick from a list",
  "need.skill_no_rate": "There is no going rate for this work on GigSync yet. Say what you would pay.",
  "need.listed_rates":
    "Workers near you list about {low} to {high} for this work ({count} workers). Say what you would pay.",
} as const;
