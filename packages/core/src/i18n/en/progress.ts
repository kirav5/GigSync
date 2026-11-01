/** A signed job's progress line, the same on both apps, and the actions on a job restored from the record. */
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
} as const;
