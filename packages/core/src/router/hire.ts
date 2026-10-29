import type { Lang } from "@gigsync/protocol";
import { NotBuiltError } from "../not-built.js";

/** True when a worker's words in Talk ask to hire someone ("मुझे कल एक हेल्पर चाहिए"), so Talk can open Find. */
export function hireIntent(_text: string, _lang: Lang): boolean {
  throw new NotBuiltError("hireIntent");
}
