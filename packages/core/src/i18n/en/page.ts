/** The pages the menu opens, each on its own: My card, Records, About me, Privacy and Settings. */
export const page = {
  // My card
  "page.card_seen": "What households see",
  "page.card_none":
    "You have no card yet. Make one with Edit my card, or tell your assistant about your work in the chat.",
  // Records: completed work, and for a household what it paid
  "page.records_soft_worker": "Work you completed on GigSync, and what it earned.",
  "page.records_soft": "Work done for you on GigSync, and what you paid.",
  "page.records_total": "Paid in all",
  "page.records_empty": "Nothing completed yet. A job shows here once the work is done.",
  "page.not_paid": "No payment noted",
  "page.not_completed": "Not completed · {count}",
  "page.paid": "Paid {price}",
  "page.paid_unconfirmed": "Paid {price} · not confirmed yet",
  // About me
  "page.about_title": "What your assistant knows.",
  // Privacy
  "page.privacy_title": "Who sees what.",
  "page.privacy_soft": "What your assistant shares, and who you keep away.",
  "page.privacy_model_title": "Your words and GigSync's model",
  "page.privacy_model_about":
    "What you write to your assistant is read by GigSync's own model, on GigSync's computer in India, so it understands you. It is not kept, and nobody else sees it. Answers to private questions, like your lowest rate, never leave this phone. Turn this off to keep everything on this phone: then only the phone's own model reads your words, or none.",
  // Settings
  "page.settings_title": "You and your assistant.",
  "page.settings_soft": "How it bargains, speaks, looks and runs. Kept on this phone.",
} as const;
