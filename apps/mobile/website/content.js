// Example content for the website's demos: the relay steps, what she says in each language, the five steps of a job
// and one worker's record as three readers see it. Names and numbers are illustrative.

export const RELAY = [
  { ct: "waiting…", h: "her number: not visible", l: "phone · address · ID: on this phone" },
  {
    ct: "from:H to:L len:412 · 9c4f a71e 02bb 7d3e e9a0 …",
    h: "her number: not visible",
    l: "phone · address · ID: on this phone",
  },
  {
    ct: "from:L to:H len:388 · 51d2 0e7a b3c9 4ff1 8a06 …",
    h: "her number: not visible",
    l: "phone · address · ID: on this phone",
    back: true,
  },
  {
    ct: "sig:H ✓ sig:L ✓ hash:7f3a…c21e · hold:slot",
    h: "her number: +91 98•• ••• 412 (this job only)",
    l: "number shared until job ends",
  },
  {
    ct: "receipt len:201 · e0b7 33aa 9d1c … (UPI happened off-server)",
    h: "her number: withdrawn",
    l: "record updated · ₹450",
    back: true,
  },
];
export const SIGNED_STEP = 3;

export const SAID = {
  hi: { cls: "hi", text: "मुझे सोमवार से शुक्रवार सुबह कोरमंगला में सफ़ाई का काम चाहिए, चार सौ से कम नहीं।" },
  hg: { cls: "", text: "Mujhe Mon se Fri subah Koramangala mein safai ka kaam chahiye, 400 se kam nahi." },
  en: { cls: "", text: "I need cleaning work Monday to Friday mornings in Koramangala, not below 400." },
  kn: { cls: "kn", text: "ಸೋಮವಾರದಿಂದ ಶುಕ್ರವಾರ ಬೆಳಿಗ್ಗೆ ಕೋರಮಂಗಲದಲ್ಲಿ ಕ್ಲೀನಿಂಗ್ ಕೆಲಸ ಬೇಕು, ನಾಲ್ಕು ನೂರಕ್ಕಿಂತ ಕಡಿಮೆ ಬೇಡ." },
};

export const STEPS = [
  {
    h: "Household asks",
    hp: "Their agent posts the job: window, budget, area. No name, no number.",
    hk: [
      ["Window", "Mon–Fri, 8–11"],
      ["Budget", "up to ₹500"],
      ["Area", "Koramangala"],
    ],
    s: "A locked envelope and a route",
    sk: [
      ["From", "H (device key)"],
      ["To", "3 matching cards"],
      ["Payload", "412 bytes, sealed"],
    ],
    ct: "9c4f a71e 02bb 7d3e e9a0 441c 7b3e 0d2a 93f1 …",
  },
  {
    h: "Her agent matches",
    hp: "Checks skill, 2 km away, inside her hours, above her ₹400 minimum. She is asked only if it fits.",
    hk: [
      ["Fit", "skill ✓ distance ✓ hours ✓"],
      ["Her minimum", "₹400 / visit"],
      ["Decision", "on her phone"],
    ],
    s: "Nothing. Matching runs on the phone.",
    sk: [
      ["Request to server", "none"],
      ["Model call", "none"],
    ],
    ct: "—",
  },
  {
    h: "Agents negotiate",
    hp: "Structured offers, capped counters. She can step in at any turn. Her rules are not negotiable by the model.",
    hk: [
      ["Offer", "₹450 a visit, Sunday off"],
      ["Counter", "₹450, start Monday"],
      ["Turns", "2 of max 4"],
    ],
    s: "Two more sealed envelopes",
    sk: [
      ["Direction", "L→H, H→L"],
      ["Readable", "no"],
    ],
    ct: "51d2 0e7a b3c9 4ff1 8a06 … / c82e 7f01 d6a4 …",
  },
  {
    h: "Both phones sign",
    hp: "Same terms hash on both devices. Only now does her number move, and only until the job ends.",
    hk: [
      ["Terms hash", "7f3a…c21e"],
      ["Signatures", "hers ✓ theirs ✓"],
      ["Number", "shared for this job"],
    ],
    s: "Two signatures on one hash, and a hold",
    sk: [
      ["Verifies", "both signatures match the hash"],
      ["Hold", "slot Mon–Fri 8–11 (opaque)"],
      ["Terms", "sealed; server cannot read"],
    ],
    ct: "sig:H 3a1f… sig:L 9bd0… hash:7f3a…c21e",
    clear: true,
  },
  {
    h: "Job done, UPI paid",
    hp: "Household pays her directly by UPI. Both ledgers update. Her number is withdrawn.",
    hk: [
      ["Receipt", "countersigned"],
      ["Paid", "₹450 · UPI · same day"],
      ["Record", "hash-chained on her phone"],
    ],
    s: "A sealed receipt. The payment never touched the server.",
    sk: [
      ["Money through server", "₹0"],
      ["Receipt", "201 bytes, sealed"],
    ],
    ct: "e0b7 33aa 9d1c 5f2e …",
  },
];

export const NOT_STORED = "—";
export const RECORD = {
  her: [
    ["Name", "Lakshmi"],
    ["Phone", "+91 98•• ••• 207"],
    ["Address", "3rd Cross, Ejipura"],
    ["Skills", "cleaning, cooking"],
    ["Minimum", "₹400 / visit"],
    ["History", "23 jobs, 23 countersigned"],
    ["Chats", "on this phone only"],
  ],
  srv: [
    ["Name", NOT_STORED],
    ["Phone", NOT_STORED],
    ["Address", NOT_STORED],
    ["Skills", NOT_STORED],
    ["Minimum", NOT_STORED],
    ["History", NOT_STORED],
    ["Envelopes", "from:L to:H · 412 B · 9c4f a71e 02bb …"],
  ],
  pub: [
    ["Name", NOT_STORED],
    ["Phone", NOT_STORED],
    ["Address", "Koramangala (coarse)"],
    ["Skills", "cleaning, cooking"],
    ["Minimum", "usual rate ₹450"],
    ["History", "23 countersigned jobs"],
    ["Chats", NOT_STORED],
  ],
};
export const VIEW_CLASS = { her: "", srv: "ct", pub: "pub" };
export const EMPTY_LABEL = { her: "not visible", srv: "not stored", pub: "not visible" };
