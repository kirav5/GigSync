import { GADGETS } from "./prod-kinds-gadgets.js";
import { HOME } from "./prod-kinds-home.js";
import { LEARNING } from "./prod-kinds-learning.js";
import { PEOPLE } from "./prod-kinds-people.js";
import type { KindPersona } from "./prod-kinds-persona.js";

export type { KindPersona } from "./prod-kinds-persona.js";

/** Every kind's worker and household for the production run, group by group as the catalog lists them (ADR 0061). */
export const PERSONAS: readonly KindPersona[] = [...HOME, ...GADGETS, ...PEOPLE, ...LEARNING];
