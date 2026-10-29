import type { UserId } from "@gigsync/protocol";

/** What the Colleagues screen shows: the list, this worker's code, the scanner, or one colleague's notes. */
export const ColleagueMode = { list: "list", show: "show", scan: "scan", thread: "thread" } as const;
export type ColleagueMode = (typeof ColleagueMode)[keyof typeof ColleagueMode];

/** Where the Colleagues screen is, and whether Back leads to its list (opened from there) or to Profile. */
export interface ColleaguePlace {
  mode: ColleagueMode;
  /** The colleague whose notes are open. */
  user?: UserId;
  fromList?: boolean;
}

export const COLLEAGUE_LIST: ColleaguePlace = { mode: ColleagueMode.list };
