import { log } from "@gigsync/core";
import type { City, MentorProfile } from "@gigsync/protocol";
import { useRef, useState } from "react";
import { answerQuestion, listingLater, offerHelp, publishListing, stopHelping } from "./listingChat.js";
import { answerWoman, askMentor, findMentors, safetyRead, sendAsk } from "./mentorChat.js";
import { type ChatRef, moveCity, openRef, turnsOf } from "./moveStore.js";
import { type Act, ActKind } from "./moveTurns.js";
import {
  answerFromGuide,
  chooseTrade,
  type MoveDeps,
  showDocuments,
  showSection,
  showStay,
  startMove,
} from "./moving.js";

/** Where a move leaves the chat: the journey screen (the checklist's one home) and Find a mentor's fallback screen. */
export interface MoveNav {
  onChecklist: (city: City) => void;
  onMoreWays: () => void;
}

/** What Talk's screen and the move's turns can do; one thing at a time, while `busy` says one is under way. */
export interface Moves {
  busy: boolean;
  start: (said: string, city: City | undefined) => void;
  /**
   * A question in a chat about a move, answered from the guide; false when the guide is not what it asks about.
   * `answering` runs just before the answer lands, so the words shown while it was found make way for it.
   */
  followUp: (said: string, answering: () => void) => Promise<boolean>;
  offer: (said: string) => void;
  stop: (said: string) => void;
  stay: (city: City, label: string) => void;
  documents: (city: City, label: string) => void;
  find: (city: City, label: string) => void;
  checklist: (city: City) => void;
  ask: (mentor: MentorProfile, label: string, city: City) => void;
  /** A chip on the agent's newest question; `label` is the chip as the owner read it. */
  act: (act: Act, label: string) => void;
}

/** What a chip that waits on the phone or the network does, in the chat's move's city where it needs one. */
function jobFor(deps: MoveDeps, ref: ChatRef, a: Act, label: string): () => Promise<unknown> {
  const city = moveCity(turnsOf(ref));
  switch (a.kind) {
    case ActKind.trade:
      return () => chooseTrade(deps, ref, a.trade, label);
    case ActKind.publish:
      return () => publishListing(deps, ref, label);
    case ActKind.section:
      return async () => city && showSection(deps, ref, label, city, a.id);
    case ActKind.woman:
      return async () => city && answerWoman(deps, ref, a.woman, label, city);
    case ActKind.safety:
      return async () => city && safetyRead(deps, ref, a.mentor, label, city);
    case ActKind.arrive:
      return async () => city && sendAsk(deps, ref, a.mentor, a.weeks, label, city);
    default:
      return async () => undefined;
  }
}

/** The move's actions, each in the chat open when it was asked, with failures logged and the composer freed after. */
export function useMoves(deps: MoveDeps, nav: MoveNav): Moves {
  const working = useRef(false);
  const [busy, setBusy] = useState(false);

  function guard(what: string, job: () => Promise<unknown>): void {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    job()
      .catch((err: unknown) => log.warn(what, { error: err instanceof Error ? err.message : String(err) }))
      .finally(() => {
        working.current = false;
        setBusy(false);
      });
  }

  /** The chips of the agent's questions, each acting in the open chat; the listing's picks answer at once. */
  function act(a: Act, label: string): void {
    const ref = openRef();
    if (a.kind === ActKind.listing) answerQuestion(deps, ref, a.answer, label);
    else if (a.kind === ActKind.notNow) listingLater(ref, label);
    else if (a.kind === ActKind.moreWays) nav.onMoreWays();
    else guard("talk chip failed", jobFor(deps, ref, a, label));
  }

  return {
    busy,
    start: (said, city) => guard("move failed", () => startMove(deps, said, city)),
    followUp: async (said, answering) => {
      const city = moveCity(turnsOf(openRef()));
      if (!city || working.current) return false;
      return answerFromGuide(deps, said, city, answering).catch(() => false);
    },
    offer: (said) => guard("offer to help failed", () => offerHelp(deps, openRef(), said)),
    stop: (said) => guard("stop helping failed", () => stopHelping(deps, openRef(), said)),
    stay: (city, label) => guard("where to stay failed", () => showStay(deps, openRef(), label, city)),
    documents: (city, label) => guard("documents failed", () => showDocuments(deps, openRef(), label, city)),
    find: (city, label) => guard("mentor search failed", () => findMentors(deps, openRef(), label, city)),
    checklist: nav.onChecklist,
    ask: (mentor, label, city) => guard("mentor ask failed", () => askMentor(deps, openRef(), mentor, label, city)),
    act,
  };
}
