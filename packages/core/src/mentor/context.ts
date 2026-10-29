import { type EngagementId, MENTOR_PROTOCOL, type UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import type { ColleagueContext } from "../colleague/store.js";
import { everyDeviceSpeaks } from "../net/reach.js";
import { MentorError, MentorRefusal } from "./errors.js";
import type { MentorStore } from "./store.js";
import type { MentorApi } from "./types.js";

/** Everything the mentor modules work with: the colleague parts (links live there), the mentor store and the API. */
export interface MentorContext {
  c: ColleagueContext;
  store: MentorStore;
  api?: MentorApi;
}

/** True when `user` has a phone signed in and every one of their phones understands the mentor envelopes. */
export const reachesMentor = (m: MentorContext, user: UserId): Promise<boolean> =>
  everyDeviceSpeaks(m.c.relay, user, MENTOR_PROTOCOL);

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
  `eng_${ulid(m.c.ctx.clock.now().getTime())}` as EngagementId;
