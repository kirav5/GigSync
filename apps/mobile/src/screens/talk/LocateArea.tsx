import type { Account } from "../../adapters/account.js";
import { placeInterview } from "../../card/interviewStore.js";
import { type FoundPlace, pilotPlace, workPlace } from "../../card/workPlace.js";
import { LocateStep } from "../address/LocateStep.js";

/** "Use my location" under the area question: for a worker whose area is not a pilot one (ADR 0045). */
export function LocateArea({ session }: { session: Account["session"] }) {
  const use = (found: FoundPlace | undefined) => {
    if (found) placeInterview(found.area, found.place);
    return found !== undefined;
  };
  return (
    <LocateStep
      session={session}
      label="card.use_location"
      onFound={(place, point) => use(workPlace(place, point))}
      onPointOnly={(point) => use(pilotPlace(point))}
    />
  );
}
