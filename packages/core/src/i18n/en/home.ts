/** The Jobs tab: its three sections and what each says when empty, the card's state, and the decisions read aloud. */
export const home = {
  // The Jobs tab: its heading, its three sections (needs you, agents talking, agreed) and the way to closed jobs
  "activity.headline": "Your jobs",
  "activity.tab_awaiting": "Needs you",
  "activity.tab_talks": "Agents talking",
  "activity.tab_agreed": "Agreed",
  "activity.tab_closed": "Closed jobs",
  "activity.standing_by": "Nothing for today. Your agent is standing by.",
  "activity.talking.one": "Your agent is talking to {count} household",
  "activity.talking.other": "Your agent is talking to {count} households",
  "activity.empty_awaiting": "Nothing waits on you. Your agents ask only when a decision is yours.",
  "activity.empty_talks": "No talks running right now.",
  "activity.empty_agreed": "Nothing agreed yet.",
  "activity.hint_worker":
    "Tell your agent about your work in the chat: “I paint houses, ₹800 a day”. Households' requests show up here.",
  "activity.hint_household":
    "Ask for something in the chat: “Need a painter on Saturday”. Your agents' work shows up here.",
  "activity.records_line": "Finished jobs are kept with your payments.",
  // The worker's Agreed by day, and their card nudges on Home
  "home.today": "Today's jobs",
  "home.upcoming": "Coming up",
  "home.other": "Other jobs",
  "home.no_card": "Make your card so customers near you can find you.",
  "home.make_card": "Make my card by talking",
  "home.card_off": "Your card is off the board, so new customers can't find you.",
  "home.details": "Details",
  "home.say_approve": "New request from {name} for {trade}. Please check it and decide.",
  "home.say_answer": "{name}'s agent has a few questions for you.",
  "home.say_sign": "{name} agreed on {price}. Do you want to sign?",
  "home.say_paid": "{name} says they paid {price}. Did the money reach you?",
} as const;
