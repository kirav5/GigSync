/** A new phone (ADR 0037): moving the owner's records to it by QR, and a worker's card coming back after a reinstall. */
export const phone = {
  // Settings rows
  "phone.move_out": "Move to a new phone",
  "phone.move_out_about": "Everything your assistant keeps here goes to your new phone with one scan.",
  "phone.move_in": "Moving from another phone? Scan its code",
  "phone.move_in_about": "Bring your jobs, money, memory and chats from your old phone.",
  // The old phone
  "phone.out_title": "Move to your new phone.",
  "phone.out_steps":
    "On the new phone, sign in with this same number. Then open Settings › Moving from another phone, and scan the code this phone shows.",
  "phone.out_start": "Show my code",
  "phone.out_making": "Packing your records…",
  "phone.out_qr_alt": "Your move code. Only your new phone, signed in with your number, can use it.",
  "phone.out_keep_open": "Keep this screen open until your new phone says it is done.",
  "phone.out_secret": "Do not show this code to anyone else: it opens your records.",
  "phone.out_safe": "Your records are locked with a key that only this code carries. GigSync's server never sees it.",
  "phone.out_countdown": "Works for {time} more",
  "phone.out_left_chats": "Your chats were too big to move: they stay on this phone. Everything else goes.",
  "phone.out_unsent": "Some messages to other people had not gone out yet. They cannot move, so they will not be sent.",
  "phone.out_expired": "The code ran out. Make a new one when your new phone is ready.",
  "phone.out_again": "Make a new code",
  "phone.out_done_title": "Moved to your new phone.",
  "phone.out_done":
    "Everything is on your new phone now. This phone is signed out of GigSync, and nobody can reach you on it any more.",
  "phone.out_ok": "OK",
  // The new phone
  "phone.in_title": "Moving from another phone?",
  "phone.in_about": "On your old phone, open Settings › Move to a new phone. Then scan the code it shows.",
  "phone.in_scan": "Scan its code",
  "phone.in_not_now": "Not now",
  "phone.in_scan_label": "Camera, looking for your old phone's code",
  "phone.in_opening": "Bringing your records over…",
  "phone.in_conflict":
    "{count} of your records are different on this phone and on the old one. Which should stay? Records only one phone has are kept either way.",
  "phone.in_keep_mine": "Keep this phone's",
  "phone.in_take_theirs": "Use the old phone's",
  "phone.in_done_title": "Your records are here.",
  "phone.in_done": "Your jobs, money, memory and settings came from your old phone. It is signed out of GigSync now.",
  "phone.in_left_chats": "Your chats were too big to move: they stay on the old phone.",
  "phone.in_revoke_failed":
    "Your records are here, but your old phone could not be signed out yet. Try again with internet.",
  "phone.in_revoke_again": "Sign out the old phone",
  "phone.in_continue": "Continue",
  "phone.camera_denied": "The camera was not allowed. Allow it in your phone's settings to scan the code.",
  "phone.no_camera": "No camera to use here. Move with a phone that has one.",
  // Why a move did not happen (MoveProblem)
  "phone.problem_too_big": "Your records are too big to move in one code, even without the chats.",
  "phone.problem_not_move": "That is not a move code. On your old phone, open Settings › Move to a new phone.",
  "phone.problem_gone": "That code was used already. Make a new one on your old phone.",
  "phone.problem_expired": "That code ran out. Make a new one on your old phone.",
  "phone.problem_same_phone": "That code is from this phone. Scan it with your new phone.",
  "phone.problem_not_yours": "That code is for another number. Sign in here with your old phone's number.",
  "phone.problem_newer": "Your old phone has a newer GigSync. Update the app on this phone first.",
  "phone.problem_damaged": "Your records did not arrive whole. Make a new code on your old phone and scan again.",
  "phone.problem_other_role":
    "Your old phone is signed in the other way (worker or household). Sign in here the same way.",
  "phone.problem_too_many": "Too many codes this hour. Try again later.",
  // A worker's card, back after a reinstall
  "phone.floor_title": "Your card is back",
  "phone.floor_about":
    "Your card came back from GigSync. Your lowest price stayed on your old phone: what is the least you take for a visit? Until you say, your assistant asks you before every quote.",
  "phone.floor_label": "Lowest price (₹)",
  "phone.floor_bad": "Enter an amount up to your usual rate, {price}.",
  "phone.approve_no_floor": "Your lowest price is not on this phone yet, so your assistant waits for you.",
} as const;
