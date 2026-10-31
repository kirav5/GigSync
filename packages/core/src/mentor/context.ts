import { type EngagementId, MENTOR_PROTOCOL, type UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import type { JobContext } from "../job/context.js";
import type { MailTransport } from "../mail/transport.js";
import type { Relay } from "../net/api.js";
import { everyDeviceSpeaks } from "../net/reach.js";
import { MentorError, MentorRefusal } from "./errors.js";
import type { LinkStore } from "./link-store.js";
import type { MentorStore } from "./store.js";
import type { MentorApi } from "./types.js";

/** What the mentor code needs from the device it lives on. */
export interface MentorDeps {
  ctx: JobContext;
  transport: MailTransport;
  relay: Relay;
}

/** Everything the mentor modules work with: the device's parts, the links and their notes, the mentor store, the API. */
export interface MentorContext extends MentorDeps {
  links: LinkStore;
  store: MentorStore;
  api?: MentorApi;
}

/** True when `user` has a phone signed in and every one of their phones understands the mentor envelopes. */
export const reachesMentor = (m: MentorContext, user: UserId): Promise<boolean> =>
  everyDeviceSpeaks(m.relay, user, MENTOR_PROTOCOL);

/** Refuses a mentor envelope to someone whose phones cannot all read it. */
export async function mustReach(m: MentorContext, user: UserId): Promise<void> {
  if (!(await reachesMentor(m, user))) throw new MentorError(MentorRefusal.tooOld);
}

/** The server's mentor routes, or a refusal when this build has none. */
export function apiOf(m: MentorContext): MentorApi {
  if (!m.api) throw new MentorError(MentorRefusal.noServer);
  return m.api;
}

/** A fresh channel: the `engagement` every envelope toward and on one mentor link carries. */
export const newChannel = (m: MentorContext): EngagementId =>
  `eng_${ulid(m.ctx.clock.now().getTime())}` as EngagementId;
