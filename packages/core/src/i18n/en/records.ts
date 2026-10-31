/** Job records kept by GigSync (ADR 0038): the sign-in line, Privacy's rows, and "My work record". */
export const records = {
  // What GigSync keeps, as Privacy and the placeholder for the documents say it
  "records.notice_kept": "What GigSync keeps: your jobs, their dates, the kind of work, the price, payments and stars.",
  "records.notice_why":
    "Why: so your work record is yours and you can take it anywhere, to make GigSync better, and to reward workers.",
  "records.notice_never":
    "We never store phone numbers, addresses or contact details on our servers, or anything you type.",
  "records.notice_delete": "You can delete your records any time, in Privacy.",
  "records.agree": "I agree",
  "records.not_now": "Not now",
  "records.agree_failed": "Could not reach GigSync. Try again when you are online.",
  // The sign-in line (ADR 0039 §4), the documents' placeholder, and the line for owners signed in before it
  "records.signin_line": "By continuing, you agree to GigSync's {link}",
  "records.signin_link": "Terms and Privacy Notice",
  "records.terms_title": "Terms and Privacy Notice",
  "records.terms_writing":
    "GigSync's Terms and Privacy Notice are being written. Until they are ready, this is what applies:",
  "records.terms_about": "What you agreed to, and what GigSync keeps and never keeps.",
  "records.terms_back": "Back",
  "records.consent_toast":
    "Using GigSync means you agree to its Terms and Privacy Notice. You can read them in Settings.",
  // Privacy
  "records.privacy_title": "My records with GigSync",
  "records.privacy_kept":
    "GigSync keeps your jobs, dates, kind of work, price, payments and stars. Never phone numbers, addresses or what you type.",
  "records.privacy_off": "GigSync is not keeping your job records.",
  "records.privacy_agree": "Read and agree",
  "records.delete": "Delete my records from GigSync",
  "records.delete_confirm_worker":
    "This deletes every job, payment and star GigSync keeps for you, and the record on your card goes back to zero. Your jobs stay on this phone. GigSync keeps nothing new until you agree again.",
  "records.delete_confirm_household":
    "This takes your name off every job GigSync keeps. Workers keep their side of the record, without you. Your jobs stay on this phone. GigSync keeps nothing new until you agree again.",
  "records.delete_yes": "Delete",
  "records.delete_cancel": "Keep them",
  "records.deleted": "Deleted. GigSync no longer keeps your job records.",
  "records.delete_failed": "Could not delete. Try again when you are online.",
  "records.show_failed": "Could not change it. Try again when you are online.",
  "records.show_needs_card": "Put your card on the board first.",
  // Download my work record, in Records
  "records.download_title": "Download my work record",
  "records.download_about": "Every job GigSync keeps for you, on any phone you sign in to, to show anyone.",
  "records.export_loading": "Getting your record…",
  "records.export_failed": "Could not get your record. Try again when you are online.",
  "records.export_empty": "No jobs kept yet. Jobs that you and the household both signed show here.",
  "records.downloaded": "Saved as {file}.",
  "records.col_date": "Date",
  "records.col_work": "Work",
  "records.col_price": "Price (₹)",
  "records.col_paid": "Received (₹)",
  "records.col_method": "Paid by",
  "records.col_status": "Status",
  "records.col_stars": "Stars",
  "records.status_agreed": "Agreed",
  "records.status_done": "Done",
  "records.status_cancelled": "Cancelled",
  "records.col_attested": "Confirmed by",
  "records.by_both": "Both",
  "records.by_you": "You only",
} as const;
