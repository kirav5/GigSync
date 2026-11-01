/** A signed job's progress line, the same on both apps, the actions on a job restored from the record, and job alerts. */
export const progress = {
  "progress.title": "Job progress",
  "progress.agreed": "Agreed",
  "progress.on_my_way": "On the way",
  "progress.started": "Started",
  "progress.done": "Done",
  "progress.paid": "Paid",
  "progress.closed": "Closed",
  "progress.cancelled": "Cancelled",
  "progress.you": "You",
  "restored.work_done": "The work is done",
  "restored.cancel": "Cancel this job",
  "restored.why":
    "This job came back from your GigSync record, so a change goes through the record and reaches {name} within a minute.",
  "restored.cancel_sure": "Cancel this job for both of you?",
  "restored.cancel_yes": "Yes, cancel",
  "restored.keep": "Keep it",
  "alerts.title": "Job alerts",
  "alerts.about":
    "A notification on this phone when a job moves on: a new request, a deal to sign, the worker on the way, done, paid or cancelled. It never shows what was said.",
  "alerts.on": "On: alerts come to this phone.",
  "alerts.turn_on": "Turn on alerts",
  "alerts.turn_off": "Turn off",
  "alerts.blocked":
    "Notifications are blocked for GigSync in this browser. Allow them in the browser's settings for this site, then come back here.",
  "alerts.install":
    "On an iPhone, alerts work in the GigSync app on your Home Screen. Add it from Share, open it from there, then turn alerts on.",
  "alerts.unsupported": "This browser can't show alerts for GigSync.",
  "alerts.unavailable": "Alerts aren't switched on for GigSync yet. Try again later.",
} as const;
