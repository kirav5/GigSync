import type {
  AddressId,
  AddressLabel,
  AnswerFromMemory,
  Arrangement,
  BoardSkill,
  DriverName,
  DriverValues,
  EstimateFact,
  Lang,
  QuestionKey,
  RateCard,
  Trade,
  UserId,
  WorkCategory,
  WorkKind,
} from "@gigsync/protocol";
import type { Known } from "../memory/known.js";
import type { AreaChoice } from "./card.js";
import type { PriceQA, PriceQuestion } from "./price-model.js";
import type { ScopeChip } from "./scope-read.js";

/** The need interview's data: what it has gathered, how it is set up, and who the need is addressed to. */

/** What the interview has gathered so far. */
export interface NeedDraft {
  trade?: Trade | undefined;
  /** The owner's own words about the need, as they said them: what the worker reads. */
  need?: string | undefined;
  /** The answer to the trade's first question (`QUESTIONS[trade][0]`); null when the owner skipped it. */
  detail?: string | null | undefined;
  /** Details the owner's words already gave, by question, kept until the trade that asks them is known. */
  seen: Partial<Record<QuestionKey, string>>;
  /** An area key: a pilot area's ("hsr_layout") or a locality's slug ("banashankari") (ADR 0045). */
  area?: string | undefined;
  /** The locality's name when the area is not a pilot area, as the saved address names it. */
  areaName?: string | undefined;
  /** The saved address the need is for (ADR 0045); its line goes to the worker only once both have signed. */
  address?: AddressId | undefined;
  /** How long the work is for (ADR 0046), for the work asked by arrangement (ADR 0051). */
  arrangement?: Arrangement | undefined;
  /** ADR 0051: the arrangements the phone's model reads the job as fitting, for work outside the trades only. */
  fits?: readonly Arrangement[] | undefined;
  /** A `DayWord`, `EVERY_DAY`, or a day as "YYYY-MM-DD". */
  day?: string | undefined;
  /** The time as the owner said it ("10 am", "सुबह"), for people only. */
  time?: string | undefined;
  /** The most they will pay. Never leaves the phone; the agent negotiates up to it. */
  budget_paise?: number | undefined;
  /** Scope read from the owner's description: chips to confirm before the estimate is asked (`need-scope.ts`). */
  scope?: { chips: readonly ScopeChip[]; confirmed: boolean } | undefined;
  /** Price drivers (ADR 0041) read from the owner's words or answered; the details give the rest (`draftDrivers`). */
  drivers?: DriverValues | undefined;
  /** Drivers the owner said they do not know: assumed by the estimate, never asked again. */
  notKnown?: readonly DriverName[] | undefined;
  /** Price questions asked so far, at most `MAX_PRICE_QUESTIONS`. */
  askedDrivers?: number | undefined;
  /** The price questions are over: the owner did not know or skipped one, or the model's are answered. */
  priceDone?: boolean | undefined;
  /** With a usable model: its questions for work outside the trades (`price-model.ts`); absent in lite mode or on failure. */
  modelAsk?: ModelAsk | undefined;
  /** The answers to the model's questions, scrubbed; kept on the phone for the owner's agent, never sent. */
  facts?: readonly EstimateFact[] | undefined;
  /** A need outside GigSync's trades, as a short label the phone's model gave ("wedding photographer"). */
  jobType?: string | undefined;
  /** ADR 0047: a skill workers here list, matched on the phone from the owner's words; set only without a trade. */
  skill?: BoardSkill | undefined;
  /** A kind of work asked for that nobody lists yet, and the others in its group that have workers. */
  emptyKind?: WorkCategory | undefined;
  others?: readonly WorkKind[] | undefined;
}

/** The model's side of the price questions: the question open, those after it, what was asked and said. */
export interface ModelAsk {
  current?: PriceQuestion | undefined;
  next?: readonly PriceQuestion[] | undefined;
  said: readonly PriceQA[];
}

/** A saved address as the interview offers it: its chip, and the area it is in. */
export interface AddressChoice {
  id: AddressId;
  label: AddressLabel;
  /** The locality's name, as the chip and the readback show it. */
  areaName: string;
  /** Its area key: the nearest pilot area's, or the locality's slug. */
  area: string;
}

export interface NeedConfig {
  /** The owner's language: the one questions are read in, and the hints the recognizer gets. */
  own: Lang;
  areas: readonly AreaChoice[];
  /** The household's saved addresses, offered at the "where" question (ADR 0045); none on a worker hiring. */
  addresses?: readonly AddressChoice[];
  /** The address at the top of Find, the one in use: the first chip at the "where" question, never taken unasked. */
  inUse?: AddressId | undefined;
  /** The city's going rates, shown as a hint beside the budget question. */
  rates: RateCard;
  /** The phone's calendar day when the interview started, "YYYY-MM-DD", for dates said without a year. */
  today: string;
  /** The phone's hour (0-23) when the interview started, so a job today is offered only hours still ahead. */
  hour?: number | undefined;
  /** A usable model (ADR 0040): it writes the price questions for work outside the trades (ADR 0058). */
  modelQuestions?: boolean;
  /** What the owner's agent remembers from past jobs, and whether to ask before using it; never the budget. */
  remembered?: NeedMemory;
}

/** The household's remembered area (a key of `areas`) and stable facts by question, and the owner's setting. */
export interface NeedMemory {
  mode: AnswerFromMemory;
  area?: Known;
  facts: Partial<Record<QuestionKey, Known>>;
}

/**
 * The one worker a need is addressed to, when the household chose them before asking (their QR, their offer to work):
 * the interview asks only what that worker needs to hear, never searches, and sends to them alone (ADR 0035).
 */
export interface NeedTo {
  user: UserId;
  /** Their name on their card, as the questions say it. */
  name: string;
  /** The trades on their card: the need is for one of them, asked only when there are several. */
  trades: readonly Trade[];
  /** ADR 0047: the skills on their card, in their words; the need may be for one of them instead. */
  skills?: readonly BoardSkill[];
}
