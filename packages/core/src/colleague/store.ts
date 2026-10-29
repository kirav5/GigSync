import type { ColleagueCard, EngagementId, LinkCode, UserId } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import { sameCode } from "./code.js";
import { type Colleague, type ColleagueDeps, type ColleagueNoteRecord, NoteFrom } from "./types.js";

/** At most this many notes are kept per colleague; the oldest drop off, so one chatty colleague cannot fill a phone. */
const MAX_NOTES_KEPT = 500;

/** A colleague code this phone showed, with the card the scanner gets back in the `ok`. */
export interface LinkCodeRecord {
  code: LinkCode;
  card: ColleagueCard;
  expires_at: string;
  used_at?: string;
}

/** A colleague as stored: what the screens see, plus this phone's own unanswered ask once theirs linked the two. */
export interface ColleagueRecord extends Colleague {
  /** The channel this phone asked on when both scanned each other at once; its `ok` may still move the link. */
  asking?: EngagementId;
}

/** What screens see of a stored colleague: the bookkeeping field stays behind. */
export function publicView({ asking: _asking, ...colleague }: ColleagueRecord): Colleague {
  return colleague;
}

const byTime = (a: ColleagueNoteRecord, b: ColleagueNoteRecord) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id);

/** Colleague links, their notes and this phone's link codes, over the Storage port. Never leaves the phone. */
export class ColleagueStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: Storage) {}

  get(user: UserId): Promise<ColleagueRecord | undefined> {
    return this.storage.get<ColleagueRecord>(Collection.colleagues, user);
  }

  list(): Promise<ColleagueRecord[]> {
    return this.storage.list<ColleagueRecord>(Collection.colleagues);
  }

  /** Changes one colleague in place; `change` returning undefined leaves it as it was. */
  update(
    user: UserId,
    change: (c: ColleagueRecord | undefined) => ColleagueRecord | undefined,
  ): Promise<ColleagueRecord | undefined> {
    return this.exclusive(async () => {
      const next = change(await this.get(user));
      if (next) await this.save(next);
      return next;
    });
  }

  /** Forgets a colleague: the link and every note with them. */
  remove(user: UserId): Promise<void> {
    return this.exclusive(async () => {
      await this.storage.delete(Collection.colleagues, user);
      await this.storage.delete(Collection.colleagueNotes, user);
    });
  }

  async notes(user: UserId): Promise<ColleagueNoteRecord[]> {
    return [...((await this.storage.get<ColleagueNoteRecord[]>(Collection.colleagueNotes, user)) ?? [])].sort(byTime);
  }

  /** Keeps one note; a note from them also counts as unread until the owner opens the thread. */
  addNote(user: UserId, note: ColleagueNoteRecord): Promise<void> {
    return this.exclusive(async () => {
      const kept = [...(await this.notes(user)), note].sort(byTime).slice(-MAX_NOTES_KEPT);
      await this.storage.put(Collection.colleagueNotes, user, kept);
      const c = await this.get(user);
      if (c && note.from === NoteFrom.them) await this.save({ ...c, unread: c.unread + 1 });
    });
  }

  /** Keeps a code this phone is about to show, clearing out the ones that have run out. */
  addCode(r: LinkCodeRecord, now: Date): Promise<void> {
    return this.exclusive(async () => {
      await this.liveCodes(now);
      await this.storage.put(Collection.linkCodes, r.code, r);
    });
  }

  /** Uses up a code this phone showed: returns it when it is unused and unexpired, marking it used, else undefined. */
  takeCode(code: string, now: Date): Promise<LinkCodeRecord | undefined> {
    return this.exclusive(async () => {
      const found = (await this.liveCodes(now)).find((r) => !r.used_at && sameCode(r.code, code));
      if (found) await this.storage.put(Collection.linkCodes, found.code, { ...found, used_at: now.toISOString() });
      return found;
    });
  }

  /** Deletes the codes past their time and returns the rest. */
  private async liveCodes(now: Date): Promise<LinkCodeRecord[]> {
    const live: LinkCodeRecord[] = [];
    for (const r of await this.storage.list<LinkCodeRecord>(Collection.linkCodes)) {
      if (Date.parse(r.expires_at) > now.getTime()) live.push(r);
      else await this.storage.delete(Collection.linkCodes, r.code);
    }
    return live;
  }

  private save(c: ColleagueRecord): Promise<void> {
    return this.storage.put(Collection.colleagues, c.user, c);
  }

  /** Read-modify-write steps run one at a time, so a note arriving while the owner sends one loses neither. */
  private exclusive<T>(step: () => Promise<T>): Promise<T> {
    const run = this.queue.then(step, step);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

/** Everything the colleague modules work with: the device's parts and the colleague store. */
export interface ColleagueContext extends ColleagueDeps {
  store: ColleagueStore;
}
