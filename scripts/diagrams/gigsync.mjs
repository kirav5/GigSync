// Draws the HLD's diagrams as SVG files in docs/gigsync/diagrams/. Run: node scripts/diagrams/gigsync.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { arrow, box, group, lanes, note, svg, TEXT2, TEXT3, text } from "./svg.mjs";

const OUT = new URL("../../docs/gigsync/diagrams/", import.meta.url);

function context() {
  return svg(
    1180,
    560,
    "GigSync: who uses it and what it talks to",
    [
      box(30, 80, 180, 60, "Gig worker", ["voice or taps"], "person"),
      box(30, 250, 180, 60, "Consumer", ["needs the work done"], "person"),
      box(30, 420, 180, 60, "Union organiser", ["supports workers"], "person"),
      box(290, 73, 230, 74, "Worker's GigSync app", ["their own agent, on their phone"]),
      box(290, 243, 230, 74, "Consumer's GigSync app", ["the consumer's own agent"]),
      box(290, 413, 230, 74, "GigSync in union mode", ["same app, usually a browser"]),
      arrow(210, 110, 290, 110),
      arrow(210, 280, 290, 280),
      arrow(210, 450, 290, 450),
      box(
        600,
        215,
        250,
        130,
        "GigSync cloud",
        ["API · one mailbox per user", "notifier · job board", "passes locked messages only"],
        "cloud",
      ),
      arrow(520, 124, 600, 240, "sealed", { both: true }),
      arrow(520, 280, 600, 280, "sealed", { both: true }),
      arrow(520, 440, 600, 322, "sealed evidence packs", { both: true, dx: -62, dy: 4 }),
      box(930, 60, 230, 64, "Helpline, welfare board", ["only fields the worker picks"], "ext"),
      box(930, 150, 230, 64, "AT Protocol (Bluesky)", ["public profile, open jobs"], "ext"),
      box(930, 250, 230, 64, "Push (FCM / APNs)", ["wake-up with no content"], "ext"),
      box(930, 350, 230, 64, "ONDC network", ["rides and delivery jobs"], "ext"),
      arrow(520, 88, 930, 92, "consented export", { dashed: true }),
      arrow(520, 104, 930, 182, "public profile"),
      arrow(850, 282, 930, 282),
      arrow(850, 322, 930, 382, "relay", { both: true, dx: 26 }),
      text(
        30,
        535,
        "Pink: people · Ink: the GigSync app · Dashed: GigSync cloud, which never reads private data · Grey: outside systems",
        {
          size: 12,
          color: TEXT3,
        },
      ),
    ].join(""),
  );
}

function containers() {
  const c1 = 40;
  const c2 = 330;
  const w = 270;
  const h = 78;
  const rows = [96, 186, 276, 366, 456];
  return svg(
    1180,
    640,
    "GigSync: containers",
    [
      group(20, 56, 600, 560, "GigSync app: Android · iPhone/Mac · web"),
      box(c1, rows[0], w, h, "UI and voice", ["React · worker, consumer or union"]),
      box(c2, rows[0], w, h, "Agent core", ["@gigsync/core · router, jobs, mail"]),
      box(c1, rows[1], w, h, "Policy checker", ["the worker's own rules · no AI"], "ok"),
      box(c2, rows[1], w, h, "Edge check", ["PII gate before anything leaves", "no AI"], "private"),
      box(c1, rows[2], w, h, "Ledger and payments", ["jobs, receipts, UPI QR"]),
      box(c2, rows[2], w, h, "Offline model (optional)", [
        "gigsync-llm: LiteRT-LM, Apple",
        "Foundation Models, web engine",
      ]),
      box(c1, rows[3], w, h, "Speech and translation", ["IndicConformer, IndicTrans2", "optional, on the device"]),
      box(c2, rows[3], w, h, "Encrypted store", ["SQLCipher · encrypted IndexedDB", "on the web"], "private"),
      box(c1, rows[4], w, h, "Device keys", ["Keystore / Keychain", "Ed25519 sign · X25519 seal"], "private"),
      box(c2, rows[4], w, h, "Background responder", ["Kotlin · same rules", "answers while the app is closed"]),
      text(
        40,
        594,
        "The agent core reaches every part through an interface (a port), so each can be swapped or left out.",
        {
          size: 12,
          color: TEXT2,
        },
      ),
      group(720, 56, 440, 320, "GigSync cloud (Cloudflare)", true),
      box(740, 96, 190, 70, "API Worker", ["sign-in, device keys, limits"], "cloud"),
      box(950, 96, 190, 70, "Mailbox", ["one per user · sealed only"], "cloud"),
      box(740, 186, 190, 70, "Notifier", ["queue → push, no content"], "cloud"),
      box(950, 186, 190, 70, "Job board", ["public profiles, open jobs"], "cloud"),
      box(740, 276, 190, 70, "ONDC relay", ["rides and delivery"], "cloud"),
      box(950, 276, 190, 70, "Web app host", ["serves the web build"], "cloud"),
      arrow(600, 135, 740, 131, "sealed", { both: true }),
      box(740, 420, 190, 64, "Push (FCM / APNs)", ["wake-up, no content"], "ext"),
      box(950, 420, 190, 64, "ONDC network", ["open network"], "ext"),
      arrow(835, 256, 835, 420),
      arrow(1045, 346, 1045, 420, "", { both: true }),
      arrow(740, 460, 600, 495, "wake-up"),
    ].join(""),
  );
}

function jobAgreed() {
  const [consumer, mailbox, notifier, worker] = [170, 430, 690, 950];
  return svg(
    1120,
    630,
    "A job is agreed, message by message",
    [
      lanes(
        ["Consumer's phone", "Mailbox (cloud)", "Notifier (cloud)", "Worker's phone"],
        [consumer, mailbox, notifier, worker],
        60,
        560,
      ),
      arrow(consumer, 140, mailbox, 140, "1 sealed job request: hours, area"),
      arrow(mailbox, 195, notifier, 195, "2 wake-up queued"),
      arrow(notifier, 250, worker, 250, "3 push, no content"),
      arrow(worker, 305, mailbox, 305, "4 fetch, verify, unseal"),
      note(790, 330, 320, 34, "5 rules check · the worker taps yes"),
      arrow(worker, 400, mailbox, 400, "6 sealed offer or counter-offer"),
      arrow(mailbox, 455, consumer, 455, "7 delivered, then deleted"),
      arrow(consumer, 510, mailbox, 510, "8 agree (terms hash), signed"),
      arrow(mailbox, 540, worker, 540, "agree"),
      note(
        75,
        570,
        970,
        36,
        "9 both phones sign the same terms and keep them · the worker's contact is shared only now, until the job ends",
        "ok",
      ),
    ].join(""),
  );
}

function payment() {
  const [worker, consumer, banks] = [170, 520, 870];
  return svg(
    1040,
    600,
    "The worker gets paid (pilot: UPI QR, no gateway)",
    [
      lanes(["Worker's phone", "Consumer's UPI app", "Banks (UPI)"], [worker, consumer, banks], 60, 540),
      note(70, 120, 200, 34, "job agreed · amount set"),
      arrow(worker, 190, consumer, 190, "shows QR: upi://pay?pa=…&am=…"),
      arrow(worker, 240, consumer, 240, "or a sealed payment request (remote)", { dashed: true }),
      arrow(consumer, 300, banks, 300, "the consumer approves the payment"),
      arrow(banks, 360, worker, 360, "money reaches the worker's bank"),
      arrow(consumer, 420, worker, 420, "if on GigSync: 'paid' + UPI reference", { dashed: true }),
      note(40, 455, 290, 34, "the worker taps Received → recorded on the job", "ok"),
      text(
        24,
        578,
        "No gateway and no fee: GigSync never holds or moves the money (ADR 0011). Planned Android auto-detect: ADR 0012.",
        {
          size: 12,
          color: TEXT3,
        },
      ),
    ].join(""),
  );
}

function piiBoundary() {
  const col = (x, caption, a, b, c) => [
    group(x, 56, 360, 350, caption),
    box(x + 20, 96, 320, 78, ...a),
    arrow(x + 180, 174, x + 180, 196),
    box(x + 20, 196, 320, 78, ...b),
    arrow(x + 180, 274, x + 180, 306),
    box(x + 20, 306, 320, 78, ...c),
  ];
  return svg(
    1180,
    470,
    "Private data: raw on the phone, checked at the edge (ADR 0013)",
    [
      ...col(
        20,
        "The worker's own context",
        ["The worker says or types", ['"remember my number is …"']],
        ["Encrypted private store", ["the raw value, kept as typed", "SQLCipher · never leaves the phone"], "private"],
        ["Offline model may read it", ["to answer the worker", "or tidy their own notes"]],
      ),
      ...col(
        410,
        "Talking to another agent",
        ["Message from another agent", ["data, never an instruction"], "ext"],
        ["IDs become placeholders", ["PHONE_1, AADHAAR_1 · no AI"], "private"],
        ["Model drafts the reply", ["sees placeholders only"]],
      ),
      ...col(
        800,
        "The edge: before anything leaves",
        ["Edge check (no AI)", ["finds PII in every outgoing", "message, export and log"], "private"],
        ["Allowed by a grant?", ["e.g. contact, after both sign"]],
        ["Real value restored, then sealed", ["otherwise blocked and shown", "to the worker"], "ok"],
      ),
      arrow(750, 345, 820, 140, "draft"),
      text(
        24,
        446,
        "Raw values never leave the phone unless a grant allows that field. Logs show them only on a developer's own machine.",
        {
          size: 12,
          color: TEXT3,
        },
      ),
    ].join(""),
  );
}

mkdirSync(OUT, { recursive: true });
const diagrams = { context, containers, "job-agreed": jobAgreed, payment, "pii-boundary": piiBoundary };
for (const [name, draw] of Object.entries(diagrams)) {
  writeFileSync(new URL(`${name}.svg`, OUT), draw());
}
console.log(`wrote ${Object.keys(diagrams).length} diagrams to docs/gigsync/diagrams/`);
