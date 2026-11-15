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
  // The Jobs tab: the day a job is on, or was finished on, as a heading over its jobs
  "jobs.day.yesterday": "Yesterday",
  "jobs.day.week": "This week",
  "jobs.day.coming": "Coming up",
  "jobs.day.earlier": "Earlier",
  "jobs.day.other": "Other days",
  // ...the finished jobs under the open ones, and the page with no jobs at all
  "jobs.done": "Done",
  "jobs.empty": "No jobs yet",
  // Home: the money card under the week's total, and the way into Talk
  "jobs.payments.one": "{count} payment",
  "jobs.payments.other": "{count} payments",
} as const;
