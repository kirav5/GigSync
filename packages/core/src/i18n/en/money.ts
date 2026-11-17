/**
 * The earnings tiles and work record in Records, from jobs signed on GigSync; the worker's money actions inside a job;
 * the household's Pay, and recommending the worker after the job.
 */
export const money = {
  "passbook.week": "Received this week",
  "passbook.month": "Received this month",
  "passbook.not_asked": "Not asked for yet",
  "passbook.empty": "Your paid jobs show here.",
  "passbook.about": "Each line is a job you and the customer both signed. It stays on this phone.",
  "money.ask_again": "Ask for payment again",
  "money.ask_advance": "Ask for an advance",
  "money.advance_amount": "Advance in rupees",
  "money.advance_cap": "Up to {price}. The rest comes after the work is done.",
  "money.ask_balance": "Ask for the remaining {price}",
  "money.ask_month": "Ask for this month's payment",
  "money.show_qr": "Show my QR",
  "money.hide_qr": "Hide QR",
  "money.cash_confirm": "Record {price} received in cash?",
  "money.need_upi": "Add the UPI ID customers pay you on.",
  "money.add_upi": "Add UPI ID",
  "money.nudge": "Add your UPI ID before this job ends, so the customer can pay you straight away.",
  "money.waiting": "Waiting for {name} to pay {price}.",
  "money.asked_at": "Asked {time}",
  "money.already_in_bank": "It's already in my bank",
  "money.bank_confirm": "Mark {price} as received?",
  // The money steps of an opened job in the redesign: the worker's ask and confirm (W13, W14), the household's Pay
  // (H11), and recommending the worker after the review (H12).
  "money.done_ask": "Work done. Ask for your {price}.",
  "money.ask_for": "Ask for {price}",
  "money.straight": "{name} pays straight to you, by UPI or in cash.",
  "money.no_cut": "GigSync never holds the money and never takes a cut.",
  "money.says_paid": "{name} says they paid",
  "money.by_upi": "UPI",
  "money.saved_note": "When you confirm, the payment is saved to your work record.",
  "money.qr_sub": "If {name} would rather scan and pay now",
  "money.asks_for": "{name} asks for",
  "money.done_at": "Work done · {time}",
  "money.pay_to": "To {vpa}",
  "money.holds_nothing": "Straight to {name}. GigSync holds nothing.",
  "money.upi_opens":
    "Your UPI app opens with {name}'s UPI ID and the amount filled in. When you come back, tap “{paid}”.",
  "money.cash_hint": "Paid in cash? {name} marks it on their phone.",
  "money.other_way": "Pay another way, or add the UPI reference",
  "money.utr_why": "The 12-digit reference from your UPI app helps {name} find the payment.",
  "money.recommend_title": "Recommend {name} to someone you know",
  "money.recommend_private": "GigSync reads no contacts and never sees whom you send it to.",
} as const;
