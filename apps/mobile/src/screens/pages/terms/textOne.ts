import type { SectionText } from "./sections.js";

/** Sections 1 to 7 of the Terms, in English: what the app is, accounts, the agent, jobs and safety. */
export const TEXT_ONE: SectionText<"about" | "service" | "account" | "agent" | "jobs" | "cancel" | "conduct"> = {
  about: [
    'These terms are an agreement between you and us, the people who run this app (together, the "app", "we" or "us").',
    [
      'They apply to everyone who uses the app: people who offer work ("workers") and people who look for help at home ("households").',
      "By signing in, you agree to these terms and to the privacy notice in section 8, which says what we keep and what stays on your phone.",
      "If you use the app for someone else, such as an elderly parent, you confirm you may agree for them.",
      "If you do not agree, please do not use the app.",
    ],
  ],
  service: [
    "The app helps households and workers near each other find one another and agree on work directly. It is a directory of workers' cards plus a personal AI assistant on each person's phone.",
    [
      [
        "A directory.",
        "Workers publish a card: their work, area, how far they travel, their usual price and the days they work. Households search it.",
      ],
      [
        "An AI assistant for each person.",
        "The app on your phone can ask questions, suggest a fair price from local rates, and talk to the other person's assistant within the limits you set.",
      ],
      [
        "Not an employer or an agency.",
        "We do not employ, train, supervise or send workers. Each worker is independent and decides which work to take. We are not a party to any job.",
      ],
      [
        "No commission.",
        "We take no cut from the worker's pay and charge no booking fee. If that ever changes, we will say so in the app before it applies to you.",
      ],
      ["India only.", "The app is meant for use in India. Some features work only in the cities where it is live."],
    ],
  ],
  account: [
    "You sign in with your own mobile number and a one-time code sent to it by SMS. You must be at least 18 years old.",
    [
      [
        "One number, one account.",
        "Use a number you own. You are responsible for what is done from your phone and your account.",
      ],
      ["True details.", "Give your real name and keep your card accurate: your work, area, price and days."],
      [
        "ID check (optional).",
        "A worker may check their Aadhaar on the phone, using UIDAI's own digital signature. Once checked, the name on the Aadhaar is the name others see; the name you typed stays on your phone as a private nickname. We never keep the Aadhaar number, address or photo.",
      ],
      [
        "Each phone signs in on its own.",
        "Signing in on a second phone gives that phone its own session; both stay signed in until you sign out or the session ends.",
      ],
      [
        "We may refuse or pause an account",
        "that gives false details, impersonates someone, or breaks these terms (see section 12).",
      ],
    ],
  ],
  agent: [
    "Your assistant acts for you only within the limits you set, and a job is agreed only when it is signed.",
    [
      [
        "What it does.",
        "Your assistant may answer, ask and propose prices for you. Your lowest price (worker) and highest budget (household) stay on your phone and are never shown to the other side.",
      ],
      [
        "You sign.",
        "A job is agreed only when both people sign it in the app. If you turn on auto-sign in Settings, your assistant may sign for you within your limits; you can turn it off at any time.",
      ],
      [
        "Guides, not promises.",
        "Price ranges and suggestions come from local rates and past jobs. They help you decide; they do not bind anyone.",
      ],
    ],
  ],
  jobs: [
    "The work, the price and the time are agreed directly between the household and the worker, and the household pays the worker directly. We never hold the money.",
    [
      [
        "The agreement is between the two of you.",
        "The signed job records the work, price, time and any terms (for example who buys materials). The app is not an employer of either of you and not a party to the job.",
      ],
      [
        "Payment.",
        "The household pays the worker directly, by UPI or cash, as agreed. We are not a payment processor or collection agent and take no part of the payment.",
      ],
      ["Taxes.", "Each person is responsible for any tax that applies to them."],
      ["Extra work.", "If you change the work or the time on the day, agree it in the app so both records stay right."],
      ["Tips", "are always the household's choice and go entirely to the worker."],
    ],
  ],
  cancel: [
    "Either person can cancel a signed job in the app; please do it as early as you can, and say why.",
    [
      [
        "No cancellation fee",
        "is charged by us. Any amount for a late cancellation is only what the two of you agreed in the job's terms.",
      ],
      [
        "If something goes wrong",
        "(the worker does not come, the work is not as agreed, payment is not made), report it from the job in the app. The record of the signed job is kept for both of you.",
      ],
      [
        "We do not judge or refund disputes about the work,",
        "because we do not take or hold payment. We can share the job record with you, point you to the helplines and unions listed in Help, and act on accounts that break these terms.",
      ],
      [
        "Safety first.",
        "In an emergency call 112. Report any harassment, threat or unsafe place as soon as you can, from the app or to the Grievance Officer (section 13).",
      ],
    ],
  ],
  conduct: [
    "Treat every person you meet through the app with courtesy and respect, and keep each other safe.",
    [
      [
        "No discrimination",
        "on the basis of caste, religion, gender, gender identity, sexual orientation, disability, age, place of origin, language or marital status.",
      ],
      [
        "Households",
        "give a safe place to work, the tools and materials agreed, water and access to a toilet, and fair hours.",
      ],
      ["Workers", "do the work agreed, with care, and respect the household's home and belongings."],
      [
        "Blocking.",
        'Either person can block the other from "People you know". A blocked person can no longer send you requests, find you in search, or write to you. You can unblock at any time. Blocking does not cancel a job already signed; cancel it as in section 6.',
      ],
      [
        "Reporting.",
        "Report anyone who harms, threatens or cheats you from the job or their name in the app, or to the Grievance Officer.",
      ],
      "A person may refuse or stop work at any time if they feel unsafe.",
    ],
  ],
};
