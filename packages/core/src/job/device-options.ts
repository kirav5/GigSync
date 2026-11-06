import type { ContactCard, DeviceId, Lang, UserId } from "@gigsync/protocol";
import type { EstimateOptions } from "../estimate/lookup.js";
import type { MentorApi } from "../mentor/types.js";
import type { Relay } from "../net/api.js";
import type { Clock, Keys, Model, Random, Storage } from "../ports.js";
import type { QrApi } from "../qr/types.js";
import type { RecordsApi } from "../records/types.js";
import type * as worker from "./worker.js";

/** What a phone's agent is built from: its ports, its owner, and the server's routes it may use. */
export interface DeviceOptions {
  relay: Relay;
  storage: Storage;
  keys: Keys;
  clock: Clock;
  /** Draws each job's hidden negotiation settings; the app passes the platform's cryptographic source (ADR 0033). */
  random: Random;
  me: { user: UserId; device: DeviceId };
  contact: ContactCard;
  /** The owner's language. Defaults to English. */
  lang?: Lang;
  /** Sign deals the agent reaches without asking. Off by default: the owner taps to sign. */
  autoConfirm?: boolean;
  /** Set on a worker's phone: what they do, where, and at what price. */
  worker?: worker.WorkerRules;
  /** The phone's model, if any: the worker's agent asks it what to ask, the household's agent what was already said. */
  model?: Model;
  /** The server's mentor routes; without them the phone can still introduce, answer and use mentor links. */
  mentorApi?: MentorApi;
  /** The server's rate estimates; without them plans come from the city's rates, as before. */
  estimates?: EstimateOptions;
  /** The server's personal QR routes; without them the phone can still receive and answer offers to work. */
  qrApi?: QrApi;
  /** The server's job record routes (ADR 0038); without them nothing about a job leaves the phone. */
  records?: RecordsApi;
}
