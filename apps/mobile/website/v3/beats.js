// The story the demo's two phones play, beat by beat. `ch` is the chapter (the list on the left) a beat belongs to, and
// each chapter shows its point on the phones: being found, the clear request, the private limits, the OK,
// the written contract, the payment, the numbers hidden again, the record, the circle in a new city.
//
// A beat either adds something to one phone's chat (me, bot, typing, card, buttons, note), to both (`both`), sends the
// sealed note across (`seal`), or turns a phone to one of its own screens (`view`) until another view beat turns it back.

export const WORKER = "worker";
export const HOME = "home";
export const TO_WORKER = "to-worker";
export const TO_HOME = "to-home";
/** The phone's screens besides the chat, matching `data-view` in the page. */
export const View = { chat: "chat", found: "found", record: "record", circle: "circle" };

export const BEATS = [
  { ch: 0, on: WORKER, view: View.found },
  { ch: 0, on: HOME, me: "Need someone to clean, weekdays 8 to 11, Koramangala. Around ₹400 a visit?" },
  { ch: 0, on: HOME, typing: true },
  {
    ch: 0,
    on: HOME,
    card: { k: "Found nearby", b: "Lakshmi · Cleaner", li: ["2 km away · Kannada, Hindi", "47 jobs, both signed"] },
  },
  { ch: 0, on: HOME, bot: "Asking Lakshmi's assistant. Your number stays hidden." },
  { ch: 0, seal: TO_WORKER },
  { ch: 1, on: WORKER, view: View.chat },
  { ch: 1, on: WORKER, typing: true },
  {
    ch: 1,
    on: WORKER,
    card: { k: "New request", b: "Cleaning · Mon–Fri, 8–11", li: ["Koramangala, 2 km away", "₹400 a visit offered"] },
  },
  {
    ch: 2,
    on: WORKER,
    cls: "limits",
    card: { k: "Your limits · only on this phone", b: "₹450 a visit", li: ["Sundays off", "Within 3 km"] },
  },
  { ch: 2, on: WORKER, bot: "₹400 is under your ₹450. I can ask for ₹450, with Sundays off." },
  { ch: 3, on: WORKER, bot: "Send this offer? Nothing goes out without your OK." },
  { ch: 3, on: WORKER, buttons: ["ಸರಿ, okay", "Change"] },
  { ch: 3, seal: TO_HOME },
  { ch: 4, on: HOME, typing: true },
  { ch: 4, on: HOME, bot: "Lakshmi offers ₹450 a visit, Mon–Fri, 8–11, Sundays off." },
  { ch: 4, on: HOME, buttons: ["Accept", "Ask"] },
  {
    ch: 4,
    both: true,
    cls: "signed",
    card: {
      k: "Contract · written for you",
      b: "Signed on both phones",
      li: ["Cleaning, Mon–Fri, 8–11", "₹450 a visit, by UPI", "Sundays off"],
    },
  },
  { ch: 5, on: HOME, me: "Paid ₹450 by UPI." },
  { ch: 5, seal: TO_WORKER },
  {
    ch: 5,
    on: WORKER,
    cls: "paid",
    card: { k: "Receipt · UPI", b: "₹450 received", li: ["Paid in full", "No cut taken"] },
  },
  { ch: 6, both: true, note: "Job paid · numbers hidden again" },
  { ch: 7, on: WORKER, view: View.record },
  { ch: 8, on: WORKER, view: View.circle },
];
