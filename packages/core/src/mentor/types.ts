import type {
  City,
  ColleagueCard,
  EngagementId,
  Introduce,
  LandingRequest,
  MatchRequestInput,
  MentorCard,
  MentorListingInput,
  MentorProfile,
  MentorReply,
  MentorReport,
  MentorRole,
  MyMentorListing,
  UserId,
} from "@gigsync/protocol";

/** What the mentor code needs from the server: workers/api's mentor routes. ApiClient implements it. */
export interface MentorApi {
  publishMentor(listing: MentorListingInput): Promise<MyMentorListing>;
  removeMentor(): Promise<void>;
  matchMentors(query: MatchRequestInput): Promise<MentorProfile[]>;
  reportMentor(report: MentorReport): Promise<unknown>;
  blockMentor(user: UserId): Promise<unknown>;
}

/** Where a landing request stands, on either phone. */
export const RequestState = {
  /** Sent, no answer yet. */
  sent: "sent",
  /** The mentor said yes; the newcomer has not confirmed yet. */
  offered: "offered",
  /** Confirmed: the mentor link is open. */
  linked: "linked",
  /** The mentor said no. */
  declined: "declined",
  /** The newcomer closed it because another link opened, or the request was blocked. */
  closed: "closed",
} as const;
export type RequestState = (typeof RequestState)[keyof typeof RequestState];

/** On the newcomer's phone: a landing request to one mentor they picked, and the mentor's answer. */
export interface SentRequest {
  channel: EngagementId;
  mentor: UserId;
  /** The mentor as the match showed them; replaced by their own card once they offer. */
  profile: MentorProfile;
  card?: MentorCard;
  /** The mentor's note with their offer. */
  note?: string;
  state: RequestState;
  at: string;
}

/** On the mentor's phone: a landing request from a newcomer, waiting for the mentor's yes or no. */
export interface ReceivedRequest {
  channel: EngagementId;
  from: UserId;
  request: LandingRequest;
  state: RequestState;
  at: string;
}

/** An introduction on one of the two introduced phones, and what each of the two said to it. */
export interface Introduction {
  channel: EngagementId;
  other: UserId;
  card: ColleagueCard;
  city: City;
  /** What the other person is here: a mentor for this phone's owner, or a newcomer they may help. */
  other_role: MentorRole;
  by: Introduce["by"];
  note?: string | undefined;
  mine?: MentorReply;
  theirs?: MentorReply;
  at: string;
}

/** An answer from the other side that came before the introduction it answers (two senders, no shared order). */
export interface EarlyReply {
  channel: EngagementId;
  from: UserId;
  reply: MentorReply;
}

/**
 * A newcomer's own answers, kept on this phone only: whether she said she is a woman (undefined until asked once),
 * whether she wants women mentors only (on by default once she says she is), and whether the safety words were read.
 */
export interface NewcomerPrefs {
  woman?: boolean;
  women_only?: boolean;
  safety_seen?: boolean;
}

/** A mentor's own choices for their listing, kept on this phone; the record counts are read fresh each time. */
export interface MentorChoices {
  /** The first name newcomers see; never a phone number. */
  first_name: string;
  city: City;
  /** A neighbourhood name people recognise ("Koramangala"), about a kilometre. */
  area: string;
  trades: ColleagueCard["trades"];
  languages: ColleagueCard["languages"];
  woman: boolean;
  women_only_newcomers: boolean;
  /** Newcomers at a time. */
  slots: number;
  /** Shown to newcomers now. */
  listed: boolean;
  /** The union or NGO the server says vouches for this mentor, if any. */
  vouched_by?: string | null;
}

/** What this phone keeps about a mentor link beyond the colleague link: whose side it is on, and the mentor's record. */
export interface MentorSide {
  /** This phone's owner's role on the link. */
  role: MentorRole;
  months?: number;
  jobs?: number;
  vouched_by?: string | null;
}
