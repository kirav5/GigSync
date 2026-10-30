/** The pages the menu opens, each on its own: My card, a household's Receipts, About me, Privacy and Settings. */
export const page = {
  // My card
  "page.card_soft_worker": "What households see, and your QR.",
  "page.card_seen": "What households see",
  "page.card_none": "You have no card yet. Make one by talking, or fill in the form.",
  "page.card_make": "Make it by talking",
  "page.see_card": "See your card as households do",
  "page.card_soft": "Show it, share it, scan someone's.",
  // A household's Receipts
  "page.receipts_soft": "Every job you paid for on GigSync.",
  "page.receipts_total": "Paid in all",
  "page.receipts_empty": "Nothing paid yet. The jobs you pay for are listed here.",
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
