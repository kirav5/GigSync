/** The worker's Home and the Jobs tab: money first, what needs you, today, and the three groups of jobs. */
export const jobs = {
  // A job's row: the word at its end, in rust when the move is the owner's
  "jobs.word.answer": "Answer",
  "jobs.word.sign": "Sign",
  "jobs.word.decide": "Decide",
  "jobs.word.check": "Check",
  "jobs.word.pay": "Pay {price}",
  "jobs.word.ask": "Ask for {price}",
  "jobs.word.review": "Review",
  "jobs.word.set_off": "On the way?",
  "jobs.word.talks": "In talks",
  // ...and the line under the name, after the work
  "jobs.line.reached": "Your agents reached {price}",
  "jobs.line.questions.one": "{count} question for you",
  "jobs.line.questions.other": "{count} questions for you",
  "jobs.line.new_time": "Can come {when}",
  "jobs.line.time_passed": "The time asked for has passed",
  "jobs.line.take_over": "The agents could not agree",
  "jobs.line.request": "A new request to check",
  "jobs.line.paid": "Says they paid {price}",
  "jobs.line.turn": "Turn {n} of {max}",
  // Home: the money card under the week's total, and the way into Talk
  "jobs.payments.one": "{count} payment",
  "jobs.payments.other": "{count} payments",
  "jobs.waiting_from": "{price} waiting from {names}",
  "jobs.talk_sub": "Ask about a job, your money or your card",
} as const;
