/** The Jobs tab: its sections and what it says with no jobs, the card's state, and the decisions read aloud. */
export const home = {
  // The Jobs tab: its heading, its sections (needs you, agents talking, agreed) and the way to closed jobs
  "activity.headline": "Your jobs",
  "activity.tab_awaiting": "Needs you",
  "activity.tab_talks": "Assistants talking",
  "activity.tab_agreed": "Agreed",
  "activity.tab_closed": "Closed jobs",
  "activity.talking.one": "Your assistant is talking to {count} household",
  "activity.talking.other": "Your assistant is talking to {count} households",
  "activity.hint_worker": "Households' requests show up here.",
  "activity.hint_household": "Your jobs show up here.",
  // Home's jobs for today, and the worker's card nudges there
  "home.no_card": "Make your card so customers near you can find you.",
  "home.make_card": "Make my card by talking",
  "home.card_off": "Your card is off the board, so new customers can't find you.",
  "home.details": "Details",
  "home.recent": "Recent",
  "home.say_approve": "New request from {name} for {trade}. Please check it and decide.",
  "home.say_answer": "{name}'s assistant has a few questions for you.",
  "home.say_sign": "{name} agreed on {price}. Do you want to sign?",
  "home.say_paid": "{name} says they paid {price}. Did the money reach you?",
} as const;
