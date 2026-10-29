import type {
  Agree,
  Cancel,
  ColleagueCard,
  ContactCard,
  Engagement,
  EngagementId,
  JobRequest,
  JobReview,
  JobTerms,
  Note,
  Offer,
  Place,
  QuestionKey,
  Role,
  Trade,
  UserId,
} from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import type { Advice } from "./advice.js";
import type { Mandate } from "./negotiate.js";

/** One job as this device sees it: the engagement plus everything said in it. Never leaves the phone. */
export interface JobRecord {
  engagement: Engagement;
  request: JobRequest;
  /** Every offer in order, from either side. */
  offers: { by: Role; offer: Offer }[];
  /** How many offers this side has made. */
  offers_made: number;
  /** Questions this side's agent has asked (worker) so it asks only once. */
  asked: boolean;
  /** The worker's price plan for this job, fixed at the first quote so every round follows the same curve. */
  mandate?: Mandate;
  /** Why the agent proposed that plan, when it came from the city's rates. */
  advice?: Advice;
  /** The worker said yes to a request their own rules said to show them first. */
  owner_ok?: boolean;
  /** Terms this side's agent accepted, waiting for the owner to sign. */
  pending?: JobTerms | undefined;
  mine?: Agree;
  theirs?: Agree;
  /** The other party's contact card: only ever set once both have signed the same terms. */
  contact?: ContactCard | undefined;
  cancel?: Cancel;
  review?: JobReview;
  /** The worker's notes (on my way, done) as received, each with its language so the screen can translate it. */
  notes?: Note[];
  /** Household side: the colleague a worker suggested after declining this request. */
  referral?: { colleague: UserId; card: ColleagueCard; at: string };
  /** Worker side: the colleague this phone suggested on this declined request. */
  referred?: UserId;
  /** The questions the worker's agent asked about this request, by key; both phones keep them for the job's story. */
  questions?: QuestionKey[];
  /** The household's answers to those questions, as written. */
  answers?: Record<string, string>;
}

/** What a consumer is looking for, shared by every request in one group. The budget stays on this phone. */
export interface Need {
  group: EngagementId;
  trade: Trade;
  need: string;
  when: string;
  area: Place;
  /** Answers given up front or later; used to answer the worker's questions. */
  details: Record<string, string>;
  budget: Mandate;
}

export const TaskKind = {
  /** The agents reached terms; sign them, or decline. */
  confirmDeal: "confirm_deal",
  /** The worker asked something the agent could not answer from the need. */
  answerQuestions: "answer_questions",
  /** The consumer says they paid; confirm the money arrived, or dispute it. */
  confirmPayment: "confirm_payment",
  /** A request has a detail the worker asked to see first (pets, say): take it, or decline. */
  approveRequest: "approve_request",
} as const;
export type TaskKind = (typeof TaskKind)[keyof typeof TaskKind];

/** A decision waiting for the owner. One per (engagement, kind); answering it removes it. */
export interface OwnerTask {
  id: string;
  kind: TaskKind;
  engagement: EngagementId;
  /** What to show: the terms to sign, the questions, or the payment. */
  detail: unknown;
  created_at: string;
}

export const taskId = (kind: TaskKind, engagement: EngagementId) => `${kind}|${engagement}`;

/** The device's job records, needs and owner tasks, over the Storage port. */
export class JobStore {
  constructor(private readonly storage: Storage) {}

  job(id: EngagementId): Promise<JobRecord | undefined> {
    return this.storage.get<JobRecord>(Collection.jobs, id);
  }
  saveJob(r: JobRecord): Promise<void> {
    return this.storage.put(Collection.jobs, r.engagement.id, r);
  }
  async jobs(): Promise<JobRecord[]> {
    const all = await this.storage.list<JobRecord>(Collection.jobs);
    return all.sort((a, b) => a.engagement.created_at.localeCompare(b.engagement.created_at));
  }
  async group(group: EngagementId): Promise<JobRecord[]> {
    return (await this.jobs()).filter((r) => r.engagement.group === group);
  }

  need(group: EngagementId): Promise<Need | undefined> {
    return this.storage.get<Need>(Collection.needs, group);
  }
  saveNeed(n: Need): Promise<void> {
    return this.storage.put(Collection.needs, n.group, n);
  }

  addTask(kind: TaskKind, engagement: EngagementId, detail: unknown, at: Date): Promise<void> {
    const id = taskId(kind, engagement);
    return this.storage.put<OwnerTask>(Collection.tasks, id, {
      id,
      kind,
      engagement,
      detail,
      created_at: at.toISOString(),
    });
  }
  task(kind: TaskKind, engagement: EngagementId): Promise<OwnerTask | undefined> {
    return this.storage.get<OwnerTask>(Collection.tasks, taskId(kind, engagement));
  }
  removeTask(kind: TaskKind, engagement: EngagementId): Promise<void> {
    return this.storage.delete(Collection.tasks, taskId(kind, engagement));
  }
  async tasks(): Promise<OwnerTask[]> {
    const all = await this.storage.list<OwnerTask>(Collection.tasks);
    return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
}
