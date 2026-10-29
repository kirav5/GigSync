import { LinkKind, type UserId } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import { type LinkNote, type MentorLink, NoteFrom, type PastLink } from "./types.js";

/** At most this many notes are kept per link; the oldest drop off, so one chatty person cannot fill a phone. */
const MAX_NOTES_KEPT = 500;

const byTime = (a: LinkNote, b: LinkNote) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id);

/** A link this build opened, as opposed to one made in person by an older build. */
export const isMentorLink = (l: MentorLink): boolean => l.kind === LinkKind.enum.mentor;

/** Mentor links, their notes and the links that have ended, over the Storage port. Never leaves the phone. */
export class LinkStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: Storage) {}

  get(user: UserId): Promise<MentorLink | undefined> {
    return this.storage.get<MentorLink>(Collection.mentorLinks, user);
  }

  list(): Promise<MentorLink[]> {
    return this.storage.list<MentorLink>(Collection.mentorLinks);
  }

  /** Changes one link in place; `change` returning undefined leaves it as it was. */
  update(user: UserId, change: (l: MentorLink | undefined) => MentorLink | undefined): Promise<MentorLink | undefined> {
    return this.exclusive(async () => {
      const next = change(await this.get(user));
      if (next) await this.save(next);
      return next;
    });
  }

  /**
   * Ends a link here: the link and every note on it go. A mentor link is remembered as past (who they are, when it
   * ended), so this owner can still introduce them; a link an older build made in person is simply forgotten.
   */
  remove(user: UserId, now: Date): Promise<void> {
    return this.exclusive(async () => {
      const link = await this.get(user);
      if (link && isMentorLink(link)) {
        const past: PastLink = { user, card: link.card, ended_at: now.toISOString() };
        await this.storage.put(Collection.pastLinks, user, past);
      }
      await this.storage.delete(Collection.mentorLinks, user);
      await this.storage.delete(Collection.linkNotes, user);
    });
  }

  /** Mentor links that have ended on this phone. */
  past(): Promise<PastLink[]> {
    return this.storage.list<PastLink>(Collection.pastLinks);
  }

  async notes(user: UserId): Promise<LinkNote[]> {
    return [...((await this.storage.get<LinkNote[]>(Collection.linkNotes, user)) ?? [])].sort(byTime);
  }

  /** Keeps one note; a note from them also counts as unread until the owner opens the link. */
  addNote(user: UserId, note: LinkNote): Promise<void> {
    return this.exclusive(async () => {
      const kept = [...(await this.notes(user)), note].sort(byTime).slice(-MAX_NOTES_KEPT);
      await this.storage.put(Collection.linkNotes, user, kept);
      const link = await this.get(user);
      if (link && note.from === NoteFrom.them) await this.save({ ...link, unread: link.unread + 1 });
    });
  }

  private save(l: MentorLink): Promise<void> {
    return this.storage.put(Collection.mentorLinks, l.user, l);
  }

  /** Read-modify-write steps run one at a time, so a note arriving while the owner sends one loses neither. */
  private exclusive<T>(step: () => Promise<T>): Promise<T> {
    const run = this.queue.then(step, step);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
