import type { UserId } from "@gigsync/protocol";
import { Collection, type Ports, type Storage } from "../ports.js";

/**
 * Collections kept once per phone and shared by everyone who signs in on it: the phone's own settings (who is signed
 * in, the language, the model) and the public city guides. Every other collection belongs to one owner.
 */
export const PHONE_COLLECTIONS: ReadonlySet<string> = new Set([Collection.settings, Collection.guides]);

/** Every collection that belongs to one owner: the ones not kept per phone. */
export const OWNED_COLLECTIONS: readonly string[] = Object.values(Collection).filter((c) => !PHONE_COLLECTIONS.has(c));

/** Between a collection's name and its owner's id; a user id (`usr_<ULID>`) never holds it. */
export const OWNER_SEP = "@";

/** Where one owner's records of a collection are kept on the phone's storage. */
export const ownedName = (collection: string, owner: UserId) => `${collection}${OWNER_SEP}${owner}`;

/**
 * The phone's storage as one owner sees it. Phones are shared and an owner's records stay when they sign out, so
 * every owned collection is kept under its owner's name: whoever signs in next reads and writes only their own, and
 * sees the last owner's again only by signing in as them. Collections kept per phone pass through unchanged.
 */
export class OwnerStorage implements Storage {
  constructor(
    private readonly base: Storage,
    readonly owner: UserId,
  ) {}

  private name(collection: string): string {
    return PHONE_COLLECTIONS.has(collection) ? collection : ownedName(collection, this.owner);
  }

  get<T>(collection: string, id: string): Promise<T | undefined> {
    return this.base.get<T>(this.name(collection), id);
  }
  put<T>(collection: string, id: string, value: T): Promise<void> {
    return this.base.put(this.name(collection), id, value);
  }
  delete(collection: string, id: string): Promise<void> {
    return this.base.delete(this.name(collection), id);
  }
  list<T>(collection: string): Promise<T[]> {
    return this.base.list<T>(this.name(collection));
  }
  ids(collection: string): Promise<string[]> {
    return this.base.ids(this.name(collection));
  }
}

/** The ports one signed-in owner's agent, screens and stores use: the same phone, with storage seen as theirs. */
export function ownerPorts(ports: Ports, owner: UserId): Ports {
  return { ...ports, storage: new OwnerStorage(ports.storage, owner) };
}
