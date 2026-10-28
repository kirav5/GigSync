/**
 * English strings, and the shape every language must match: a key missing from another language is a type error,
 * not an English word on a Hindi screen. Placeholders are `{name}`, filled by `t()`.
 */
export const en = {
  "question.problem": "What exactly isn't working?",
  "question.rooms": "How many rooms, and which tasks?",
  "question.area_sqft": "Roughly how many square feet, inside or outside?",
  "question.people": "How many people live there?",
  "question.meals": "Which meals?",
  "question.pets": "Are there any pets at home?",
  "question.route": "From where to where, and for how long?",
  "detail.problem": "the problem",
  "detail.rooms": "rooms",
  "detail.area_sqft": "area",
  "detail.people": "people",
  "detail.meals": "meals",
  "detail.pets": "pets",
  "detail.route": "the route",
  "reason.band": "The going rate for this work here is {low}–{high}.",
  "reason.scope": "{percent}% more for {item}.",
  "reason.history": "You were paid about {median} for this work before ({count} jobs).",
  "reason.floor": "Your own minimum is {floor}.",
  "reason.plan": "We will start at {opening} and not go below {limit}.",
} as const;

export type MessageKey = keyof typeof en;
export type Strings = Readonly<Record<MessageKey, string>>;
