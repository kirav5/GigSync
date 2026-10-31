/** The pages the menu opens, each on its own: My card, Records, About me, Privacy and Settings. */
export const page = {
  // My card
  "page.card_soft_worker": "Share it — anyone can ask you for work.",
  "page.card_seen": "What households see",
  "page.card_none": "You have no card yet. Make one with Edit my card, or tell your agent about your work in the chat.",
  "page.card_soft": "Share it — workers can offer to work for you.",
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
  "page.about_title": "What your agent knows.",
  // Privacy
  "page.privacy_title": "Who sees what.",
  "page.privacy_soft": "What your agent shares, and who you keep away.",
  "page.blocked": "People you blocked",
  "page.blocked_about":
    "Hidden everywhere on this phone and never matched with you again. Blocking cannot be undone here.",
  "page.blocked_none": "You have not blocked anyone.",
  "page.blocked_unnamed": "Someone you never worked with",
  "page.blocked_on": "Blocked {date}",
  // Settings
  "page.settings_title": "You and your agent.",
  "page.settings_soft": "How it bargains, speaks, looks and runs. Kept on this phone.",
} as const;
