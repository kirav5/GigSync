import { SELF } from "cloudflare:test";
import { BEARER_PREFIX, Header, HttpMethod } from "@gigsync/core";
import {
  type MatchRequestInput,
  MENTOR_MIN_JOBS,
  MENTOR_MIN_MONTHS,
  type MentorListingInput,
  type MentorProfile,
  type Trade,
} from "@gigsync/protocol";

export { ADMIN_HEADER } from "../src/context.js";

import { type Person, signIn } from "./people.js";

export const ADMIN_KEY = "test-only-admin-key";
const BASE = "http://x/v1";

/** Calls the Worker as `as` (or with no session), returning the raw response. */
export function call(
  as: Person | undefined,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  const auth: Record<string, string> = as ? { [Header.authorization]: `${BEARER_PREFIX}${as.session.token}` } : {};
  return SELF.fetch(`${BASE}${path}`, {
    method,
    headers: { ...auth, ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

/** A listing that meets the minimum record, in Bengaluru, speaking Kannada. */
export const listing = (name: string, trades: Trade[], more: Partial<MentorListingInput> = {}): MentorListingInput => ({
  first_name: name,
  city: "bengaluru",
  area: "Jayanagar",
  trades,
  languages: ["kn", "hi"],
  months: MENTOR_MIN_MONTHS,
  jobs: MENTOR_MIN_JOBS,
  woman: false,
  ...more,
});

/** Signs in and publishes a listing; fails the test unless the server accepts it. */
export async function mentor(phone: string, l: MentorListingInput): Promise<Person> {
  const p = await signIn(phone);
  const res = await call(p, HttpMethod.put, "/mentors/me", l);
  if (res.status !== 200) throw new Error(`listing refused: ${res.status}`);
  return p;
}

/** The first names a newcomer is shown for this query, in the server's order. */
export async function match(as: Person, q: MatchRequestInput): Promise<string[]> {
  const res = await call(as, HttpMethod.post, "/mentors/match", q);
  if (res.status !== 200) throw new Error(`match refused: ${res.status}`);
  const { mentors } = (await res.json()) as { mentors: MentorProfile[] };
  return mentors.map((m) => m.first_name);
}
