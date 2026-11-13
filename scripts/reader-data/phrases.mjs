// What a target's details may say (ADR 0065 §5): the words a household types for each detail, drawn at random so the
// reader sees many ways of saying each. The kinds of work come from core's own names; the rest is written here, with
// pairs that look alike on purpose ("next month" is when, "monthly" is how long) so the reader learns the difference.
import { core, protocol } from "./core.mjs";

const EN = "en";

/** How people name the trades in Indian English, beside the app's own names. */
const TRADE_WORDS = {
  maid: ["maid", "house help", "bai", "housemaid", "cleaning lady"],
  cook: ["cook", "cooking help", "someone to cook", "cook aunty"],
  driver: ["driver", "car driver", "personal driver"],
  electrician: ["electrician", "electric guy", "wireman"],
  plumber: ["plumber", "plumbing guy"],
  carpenter: ["carpenter", "furniture guy", "wood work guy"],
  ac_technician: ["AC technician", "AC mechanic", "AC service guy", "AC repair"],
  painter: ["painter", "paint job", "painting work"],
};

/** Every kind of work with the words for it: the app's English name, lower case, and for trades the common words. */
export const KINDS = [
  ...protocol.Trade.options.map((tr) => ({
    kind: tr,
    words: [core.t(EN, `trade.${tr}`).toLowerCase(), ...(TRADE_WORDS[tr] ?? [])],
  })),
  ...protocol.WorkCategory.options.map((c) => ({ kind: c, words: [core.t(EN, `category.${c}`).toLowerCase()] })),
];

const G = protocol.WorkGroup.enum;
/**
 * Words for a whole group, said as if they were a kind ("someone for home repairs"), so the reader marks them as `kind`
 * too. Only the groups people name this way; the work the writer has in mind is one of the group's own.
 */
export const GROUP_WORDS = [
  { words: "home repairs", group: G.home_repairs },
  { words: "cleaning", group: G.cleaning },
  { words: "appliance repair", group: G.appliances },
  { words: "home care", group: G.care },
].map((g) => ({ ...g, kinds: protocol.GROUP_KINDS[g.group] }));

const OTHER_AREAS = [
  "BTM Layout",
  "Marathahalli",
  "Bellandur",
  "Electronic City",
  "Malleshwaram",
  "Yelahanka",
  "Banashankari",
  "JP Nagar",
  "Rajajinagar",
  "Hebbal",
  "Sarjapur Road",
  "Kalyan Nagar",
  "Basavanagudi",
  "RT Nagar",
  "Domlur",
  "Bannerghatta Road",
  "HSR sector 2",
  "Koramangala 5th block",
  "near Forum Mall",
  "Whitefield main road",
  "Indiranagar 100 ft road",
  "near Silk Board",
];

/** Places as people write them: the pilot areas by every English name, and other localities and landmarks. */
export const WHERE = [
  ...core.PILOT_AREA_CHOICES.flatMap((a) => a.names.filter((n) => /^[\x20-\x7e]+$/.test(n))),
  ...OTHER_AREAS,
];

/** Days and times. "next month", "from next week" and "mornings" are when the work starts, never how long it is. */
export const WHEN = [
  "tomorrow",
  "today",
  "tmrw",
  "this evening",
  "tomorrow morning",
  "next monday",
  "on saturday",
  "this weekend",
  "from next week",
  "day after tomorrow",
  "at 10 am",
  "after 5 pm",
  "by 6 pm today",
  "on the 15th",
  "asap",
  "right now",
  "sunday morning",
  "mornings",
  "in the evening",
  "from 1st of next month",
  "next month",
];

const A = protocol.Arrangement.enum;

/** How the work is hired, by arrangement: how often and for how long, never when it starts. */
export const HOW_LONG = {
  [A.hourly]: ["for 2 hours", "for a few hours", "for 3 hours", "hourly basis"],
  [A.visit]: ["just once", "one time", "for a single visit", "one time job"],
  [A.weekly]: ["3 days a week", "twice a week", "on weekends only", "alternate days"],
  [A.monthly]: ["monthly", "full time", "every day", "daily", "for a month", "on a monthly basis"],
};

/** How the message is written. Spelling mistakes go anywhere except in the words a detail is marked by. */
export const STYLES = [
  "sms shorthand, all lower case, no punctuation",
  "polite and complete, one or two sentences",
  "curt, as few words as possible",
  "with a couple of spelling mistakes in the other words",
  "chatty, with one short sentence of context about the household",
  "Indian English, like 'kindly' or 'please do the needful'",
  "starting with a short greeting",
];
