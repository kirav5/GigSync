import type { ContactCard, DeviceId, EnvelopeKind, Lang, UserId } from "@gigsync/protocol";
import type { PaymentBook } from "../payments/book.js";
import type { Clock, Keys, Model, Storage } from "../ports.js";
import type { JobRecord, JobStore } from "./store.js";

/** What the job modules need from the device they run on. GigDevice provides it. */
export interface JobContext {
  me: { user: UserId; device: DeviceId };
  /** This owner's card, released to the other party only once both have signed. */
  contact: ContactCard;
  /** The owner's language: what their free text is tagged with and what their screens and voice use. */
  lang: Lang;
  /** Sign deals the agent reached without asking the owner first. */
  autoConfirm: boolean;
  store: JobStore;
  storage: Storage;
  payments: PaymentBook;
  keys: Keys;
  clock: Clock;
  /** The phone's model, when it has one: it may propose questions and match answers, never set a price. */
  model?: Model;
  /** True when every phone of `user` reports at least this capability number. */
  speaks(user: UserId, protocol: number): Promise<boolean>;
  /** Queues an envelope to the other party, applies it to the engagement (unless side-channel) and saves. */
  send(r: JobRecord, kind: EnvelopeKind, body: unknown): Promise<JobRecord>;
  /** The signing key the directory lists for a device, for checking signatures inside bodies. */
  signingKeyOf(user: UserId, device: DeviceId): Promise<string | undefined>;
}
