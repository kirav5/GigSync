import type { EngagementId, UserId } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import type { EarlyReply, Introduction, MentorChoices, NewcomerPrefs, ReceivedRequest, SentRequest } from "./types.js";

/** Ids of the single documents in `Collection.mentorSettings`. */
const SettingsDoc = { newcomer: "newcomer", choices: "choices" } as const;

/** At most this many early answers are kept: a stranger cannot fill a phone with answers to nothing. */
const MAX_EARLY = 20;

/** A blocked person: hidden everywhere on this phone. */
export interface BlockRecord {
  user: UserId;
  at: string;
}

/** Mentor requests, introductions, the owner's mentor choices and blocks, over the Storage port. Never leaves the phone. */
export class MentorStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: Storage) {}

  sent(): Promise<SentRequest[]> {
    return this.storage.list<SentRequest>(Collection.mentorRequests);
  }

  sentOn(channel: EngagementId): Promise<SentRequest | undefined> {
    return this.storage.get<SentRequest>(Collection.mentorRequests, channel);
  }

  saveSent(r: SentRequest): Promise<void> {
    return this.storage.put(Collection.mentorRequests, r.channel, r);
  }

  received(): Promise<ReceivedRequest[]> {
    return this.storage.list<ReceivedRequest>(Collection.mentorAsks);
  }

  receivedOn(channel: EngagementId): Promise<ReceivedRequest | undefined> {
    return this.storage.get<ReceivedRequest>(Collection.mentorAsks, channel);
  }

  saveReceived(r: ReceivedRequest): Promise<void> {
    return this.storage.put(Collection.mentorAsks, r.channel, r);
  }

  intros(): Promise<Introduction[]> {
    return this.storage.list<Introduction>(Collection.mentorIntros);
  }

  intro(channel: EngagementId): Promise<Introduction | undefined> {
    return this.storage.get<Introduction>(Collection.mentorIntros, channel);
  }

  /** Changes one introduction in place, one change at a time; `change` returning undefined leaves it as it was. */
  updateIntro(
    channel: EngagementId,
    change: (i: Introduction | undefined) => Introduction | undefined,
  ): Promise<Introduction | undefined> {
    return this.exclusive(async () => {
      const next = change(await this.intro(channel));
      if (next) await this.storage.put(Collection.mentorIntros, channel, next);
      return next;
    });
  }

  /** Keeps an answer to an introduction this phone has not received yet, dropping the oldest past MAX_EARLY. */
  keepEarly(r: EarlyReply): Promise<void> {
    return this.exclusive(async () => {
      const early = await this.storage.list<EarlyReply>(Collection.mentorEarly);
      for (const old of early.slice(0, Math.max(0, early.length - MAX_EARLY + 1)))
        await this.storage.delete(Collection.mentorEarly, old.channel);
      await this.storage.put(Collection.mentorEarly, r.channel, r);
    });
  }

  /** Takes the early answer kept for `channel`, if any. */
  async takeEarly(channel: EngagementId): Promise<EarlyReply | undefined> {
    const early = await this.storage.get<EarlyReply>(Collection.mentorEarly, channel);
    if (early) await this.storage.delete(Collection.mentorEarly, channel);
    return early;
  }

  newcomer(): Promise<NewcomerPrefs | undefined> {
    return this.storage.get<NewcomerPrefs>(Collection.mentorSettings, SettingsDoc.newcomer);
  }

  saveNewcomer(prefs: NewcomerPrefs): Promise<void> {
    return this.storage.put(Collection.mentorSettings, SettingsDoc.newcomer, prefs);
  }

  choices(): Promise<MentorChoices | undefined> {
    return this.storage.get<MentorChoices>(Collection.mentorSettings, SettingsDoc.choices);
  }

  saveChoices(choices: MentorChoices): Promise<void> {
    return this.storage.put(Collection.mentorSettings, SettingsDoc.choices, choices);
  }

  async isBlocked(user: UserId): Promise<boolean> {
    return (await this.storage.get<BlockRecord>(Collection.blocked, user)) !== undefined;
  }

  /** Everyone blocked on this phone, with when. */
  blocks(): Promise<BlockRecord[]> {
    return this.storage.list<BlockRecord>(Collection.blocked);
  }

  async blocked(): Promise<Set<UserId>> {
    return new Set((await this.blocks()).map((b) => b.user));
  }

  block(user: UserId, at: Date): Promise<void> {
    return this.storage.put(Collection.blocked, user, { user, at: at.toISOString() } satisfies BlockRecord);
  }

  unblock(user: UserId): Promise<void> {
    return this.storage.delete(Collection.blocked, user);
  }

  private exclusive<T>(step: () => Promise<T>): Promise<T> {
    const run = this.queue.then(step, step);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
