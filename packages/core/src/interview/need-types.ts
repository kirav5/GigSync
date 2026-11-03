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
  /** How long the work is for (ADR 0046), for the trades priced by arrangement. */
  arrangement?: Arrangement | undefined;
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
  /** The price questions are over: the owner did not know or skipped one, the model was done, or none is worth it. */
  priceDone?: boolean | undefined;
  /** With a usable phone model: its questions (`price-model.ts`); absent in lite mode or once the model failed. */
  modelAsk?: ModelAsk | undefined;
  /** Facts the phone's model wrote from the answers, scrubbed; kept on the phone for the owner's agent, never sent. */
  facts?: readonly EstimateFact[] | undefined;
  /** A need outside GigSync's trades, as a short label the phone's model gave ("wedding photographer"). */
  jobType?: string | undefined;
  /** ADR 0047: a skill workers here list, matched on the phone from the owner's words; set only without a trade. */
  skill?: BoardSkill | undefined;
}

/** The model's side of the price questions: the question waiting, what was asked and said, what it covered. */
export interface ModelAsk {
  current?: PriceQuestion | undefined;
  said: readonly PriceQA[];
  /** Drivers the model's questions filled: the safeguard adds the top driver only when it is not among them. */
  covered: readonly DriverName[];
  /** The job's most price-moving unknown driver when the model began: the one question code guarantees. */
  top?: DriverName | undefined;
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
  /** The city's going rates, shown as a hint beside the budget question. */
  rates: RateCard;
  /** The phone's calendar day when the interview started, "YYYY-MM-DD", for dates said without a year. */
  today: string;
  /** The phone's hour (0-23) when the interview started, so a job today is offered only hours still ahead. */
  hour?: number | undefined;
  /** The phone has a usable model (ADR 0040): it decides the price questions; lite mode asks the fixed ones. */
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
