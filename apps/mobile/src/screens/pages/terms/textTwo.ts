import type { SectionText } from "./sections.js";

/** Sections 8 to 13 of the Terms, in English: privacy in short, deletion, the rules, content, liability and law. */
export const TEXT_TWO: SectionText<"privacy" | "deletion" | "rules" | "content" | "liability" | "law"> = {
  privacy: [
    "The app is built so that your private details stay on your phone. This is the privacy notice in short; the full notice will list exactly what we keep, why and for how long.",
    [
      [
        "Stays on your phone:",
        "your phone number and address, your lowest price or budget, your chats with your assistant, your nickname, and the result of an Aadhaar check.",
      ],
      [
        "Shared only after both of you sign a job:",
        "your phone number and the exact address, with that one person, for that job, and with no one else.",
      ],
      [
        "Kept on our servers:",
        "a one-way protected form of your number (so the same number reaches the same account), your phone's public keys, workers' public cards, and blocks. Job records (date, kind of work, price, payments and stars) only if you agreed to them.",
      ],
      [
        "Messages between assistants",
        "pass through our servers sealed, so only the other phone can open them, and are deleted once delivered or expired.",
      ],
      ["Sign-in codes", "are sent through an SMS provider, which sees your number to deliver the code."],
      ["No selling, no ads.", "We do not sell your data and do not show ads."],
      ["Law enforcement.", "We share data only when Indian law requires it, and only what we hold."],
    ],
  ],
  deletion: [
    "You decide what stays.",
    [
      ["Your job records.", "Delete them from Privacy at any time; we then keep nothing new until you agree again."],
      [
        "Your account.",
        "Ask us to delete your account and everything we hold for it, from Help or at the contact in section 13. We delete it all, except what the law makes us keep.",
      ],
      [
        "On your phone.",
        "Signing out keeps your jobs and settings on the phone under your name, for when you sign in again. Removing the app, or its data, deletes them from the phone.",
      ],
    ],
  ],
  rules: [
    "You may use the app only to find, offer and agree on real work, honestly and within the law. You may not:",
    [
      "post false details, use someone else's number or Aadhaar, or pretend to be another person;",
      "harass, threaten, abuse or discriminate against anyone, or share another person's private details;",
      "post content that is unlawful, obscene, hateful or harmful to children;",
      "use the app to traffic people, for bonded or child labour, or for any work that is illegal;",
      "copy, scrape or bulk-download cards or data, or use bots or automated tools on the app;",
      "try to break, overload, reverse-engineer or get around the app's security, or spread harmful code.",
    ],
    "Working again with someone you met here, without the app, is your free choice; the app's records and protections then no longer cover that work.",
  ],
  content: [
    "What you write stays yours; you let us show it as the app describes, only to run the app.",
    [
      [
        "Your content",
        "(card text, requests, ratings, notes) remains yours. You give us a free, non-exclusive licence to store, show and translate it in the app for as long as it is there.",
      ],
      ["Ratings", "must be honest and about the work. We may remove content that breaks these terms."],
      [
        "The app",
        "(its design, name and marks) belongs to us or our licensors. You may use it, not copy or resell it.",
      ],
      ["Feedback", "you send us may be used to improve the app, with no payment owed."],
    ],
  ],
  liability: [
    "You can stop using the app at any time; we can pause or close an account that breaks these terms or the law.",
    [
      [
        "Ending.",
        "We may pause or close an account at once for a serious breach (for example harassment, fraud or false identity), or with 7 days' notice for any other good reason. Jobs already signed stay recorded for both people.",
      ],
      [
        "As it is.",
        'The app is provided "as is". We work to keep it running and accurate, but do not promise it will always be available or free of errors.',
      ],
      [
        "Workers and households are independent.",
        "We do not verify every claim on a card, do not run police checks, and are not responsible for the work done, its quality, payment between you, or damage during a job. The optional Aadhaar check proves only that the name is genuine.",
      ],
      [
        "Limit.",
        "As far as the law allows, we are not liable for indirect or consequential loss, and our total liability to you is limited to [amount to be set]. Nothing here removes rights you have under Indian consumer law.",
      ],
      [
        "Indemnity.",
        "If your breach of these terms or the law causes a claim against us, you agree to cover its reasonable cost.",
      ],
    ],
  ],
  law: [
    "These terms follow Indian law. Talk to us first; the courts decide what we cannot settle.",
    [
      [
        "Law and courts.",
        "These terms are governed by the laws of India. The courts at [place to be confirmed] have jurisdiction. Before going to court, either side may ask for mediation.",
      ],
      [
        "Grievance Officer",
        "(Information Technology Act, 2000 and its Rules; Consumer Protection (E-Commerce) Rules, 2020): Name: [to be added]. Address: [to be added]. Email: [to be added]. Monday to Saturday, 10 am to 6 pm. We acknowledge a complaint within 24 hours and resolve it within 15 days.",
      ],
      [
        "Changes.",
        "We may update these terms. We will show the change in the app at least 7 days before it applies, except changes the law requires sooner. Using the app after that means you accept the new terms.",
      ],
      [
        "Languages.",
        "Section titles and summaries are offered in English, Hindi and Kannada; the full text is in English for now. If the versions differ, the English one applies.",
      ],
      ["Contact:", "Help in the app, or [contact email to be added]."],
    ],
  ],
};
