/** The pages the menu opens, each on its own: My card, Records, About me, Privacy and Settings. */
export const page = {
  // My card
  "page.card_seen": "What households see",
  "page.card_none":
    "You have no card yet. Make one with Edit my card, or tell your assistant about your work in the chat.",
  // Records: completed work, and for a household what it paid
  "page.records_soft_worker": "Work you completed on GigSync, and what it earned.",
  "page.records_soft": "Work done for you on GigSync, and what you paid.",
  "page.records_empty": "Nothing here yet. Work done for you shows here once it is finished.",
  "page.not_paid": "No payment noted",
  "page.not_completed": "Not completed · {count}",
  "page.paid": "Paid {price}",
  "page.paid_unconfirmed": "Paid {price} · not confirmed yet",
  // About me
  "page.about_title": "What your assistant knows.",
  // Privacy
  "page.privacy_title": "Who sees what.",
  "page.privacy_soft": "What your assistant shares, and who you keep away.",
  // Settings
  "page.settings_title": "You and your assistant.",
  "page.settings_soft": "How it bargains, speaks, looks and runs. Kept on this phone.",
} as const;
