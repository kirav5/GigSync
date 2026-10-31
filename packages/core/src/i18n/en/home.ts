/** Activity: what the agents are doing, its counters and sections, the card's state, and the decisions read aloud. */
export const home = {
  // Activity, as collab's: the headline, the four counters and what each says when empty
  "activity.headline": "What your agents are doing",
  "activity.tabs": "Your jobs, by where they stand",
  "activity.tab_awaiting": "Awaiting you",
  "activity.tab_talks": "In talks",
  "activity.tab_agreed": "Agreed",
  "activity.tab_closed": "Closed",
  "activity.standing_by": "Your agents are standing by.",
  "activity.awaiting.one": "{count} decision waits on you.",
  "activity.awaiting.other": "{count} decisions wait on you.",
  "activity.talking.one": "Your agents are in {count} talk.",
  "activity.talking.other": "Your agents are in {count} talks.",
  "activity.empty_awaiting": "Nothing waits on you. Your agents ask only when a decision is yours.",
  "activity.empty_talks": "No talks running right now.",
  "activity.empty_agreed": "Nothing agreed yet.",
  "activity.hint_worker":
    "Tell your agent about your work in the chat: “I paint houses, ₹800 a day”. Households' requests show up here.",
  "activity.hint_household":
    "Ask for something in the chat: “Need a painter on Saturday”. Your agents' work shows up here.",
  "activity.records_line": "Finished jobs are in Records.",
  "activity.records_open": "Open Records",
  // The sections inside Agreed, and the worker's card nudges
  "home.today": "Today's jobs",
  "home.upcoming": "Coming up",
  "home.other": "Other jobs",
  "home.jobs": "Your jobs",
  "home.no_card": "Make your card so customers near you can find you.",
  "home.make_card": "Make my card by talking",
  "home.card_off": "Your card is off the board, so new customers can't find you.",
  "home.details": "Details",
  "home.say_approve": "New request from {name} for {trade}. Please check it and decide.",
  "home.say_answer": "{name}'s agent has a few questions for you.",
  "home.say_sign": "{name} agreed on {price}. Do you want to sign?",
  "home.say_paid": "{name} says they paid {price}. Did the money reach you?",
} as const;
