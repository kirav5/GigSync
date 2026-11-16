/** A signed job's progress line, the same on both apps, the actions on a job restored from the record, and notifications. */
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
  "progress.state.done": "completed",
  "progress.state.now": "current step",
  "progress.state.next": "still to come",
  "progress.state.stopped": "stopped here",
  "progress.stopped_at": "Stopped at: {step}",
  "progress.next_worker.on_my_way": "Time to set off",
  "progress.next_worker.started": "Arrive and start work",
  "progress.next_worker.done": "Finish the work",
  "progress.next_worker.paid": "{name} pays you",
  "progress.next_household.on_my_way": "{name} sets off",
  "progress.next_household.started": "{name} arrives and starts work",
  "progress.next_household.done": "{name} finishes the work",
  "progress.next_household.paid": "You pay {name}",
  "restored.work_done": "The work is done",
  "restored.cancel": "Cancel this job",
  "restored.why":
    "This job came back from your GigSync record, so a change goes through the record and reaches {name} within a minute.",
  "restored.cancel_sure": "Cancel this job for both of you?",
  "restored.cancel_yes": "Yes, cancel",
  "restored.keep": "Keep it",
  "alerts.title": "Notifications",
  "alerts.native_body": "Something new on your job. Open GigSync to see it.",
  "alerts.channel": "Job alerts",
  "alerts.about_app":
    "A notification on this phone when a job moves on. It says only that something is new, so nobody on the way learns more; open GigSync to see what.",
  "alerts.blocked_app":
    "Notifications are off for GigSync on this phone. Turn them on in the phone's Settings › Apps › GigSync › Notifications, then come back here.",
  "alerts.about":
    "A notification on this phone when a job moves on, saying who it is from and what happened: a new request, a deal signed, on the way, done, paid or cancelled. It never shows what was said, and Google or Apple cannot read it on the way.",
  "alerts.on": "On: notifications come to this phone.",
  "alerts.blocked":
    "Notifications are blocked for GigSync in this browser. Allow them in the browser's settings for this site, then come back here.",
  "alerts.install":
    "On an iPhone, notifications work in the GigSync app on your Home Screen. Add it from Share, open it from there, then turn notifications on.",
  "alerts.unsupported": "This browser can't show notifications for GigSync.",
  "alerts.unavailable": "Notifications aren't switched on for GigSync yet. Try again later.",
} as const;
