import {
  asksGuide,
  countListed,
  documentsReply,
  estimateRequest,
  type FoundEstimate,
  firstSteps,
  type GigDevice,
  type GuideReply,
  loadGuide,
  type Ports,
  phraseOutlook,
  questionReply,
  sectionReply,
  stayReply,
  workOutlook,
} from "@gigsync/core";
import { type City, type CityGuide, type Lang, Trade } from "@gigsync/protocol";
import { type Account, apiClient } from "../adapters/account.js";
import { fetchEstimate } from "../estimate/useEstimate.js";
import { agentSays, type ChatRef, moveCity, openRef, say, turnsOf } from "./moveStore.js";
import { ActKind, type GuideAnswerKept, MoveSpeaker } from "./moveTurns.js";
import { nextTurnId, noteTurn, type Turn } from "./turns.js";

/**
 * A move to a new city, answered in the chat it was said in: the work outlook for the owner's trades there (or the
 * question which work they do), what to sort first from the city's guide, and the guide's answers to "where to
 * stay", "documents" and the owner's own questions. The guide is the copy on the phone when fresh, else downloaded.
 */

/** What a move's answers are built with: the owner's phone, account and device, and the language they read. */
export interface MoveDeps {
  ports: Ports;
  account: Account;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  lang: Lang;
}

/** The guide could not be downloaded and is not on the phone yet. */
const noGuide = (): Turn => agentSays([{ key: "landing.no_guide" }]);

async function guideOf({ ports, account }: MoveDeps, city: City): Promise<CityGuide | undefined> {
  const fetchGuide = (c: City) => apiClient(account.session).cityGuide(c);
  return (await loadGuide(ports.storage, fetchGuide, city, ports.clock.now()))?.guide;
}

/** One trade's estimate at its default scope, and how many of its workers the board has in the city. */
async function tradeFigures(deps: MoveDeps, city: City, trade: Trade) {
  const session = deps.account.session;
  const request = estimateRequest(city, trade);
  const api = apiClient(session);
  const [found, listed] = await Promise.all([
    request ? fetchEstimate(session, request) : Promise.resolve(undefined),
    countListed((query) => api.searchWorkers(query), city, trade, session.user),
  ]);
  return { trade, found, listed };
}

/** The work outlook for these trades in the city, built by code, worded by a model only when that passes the checks. */
export async function outlookTurn(deps: MoveDeps, city: City | undefined, trades: readonly Trade[]): Promise<Turn> {
  const figures = city ? await Promise.all(trades.map((trade) => tradeFigures(deps, city, trade))) : [];
  const estimates: Partial<Record<Trade, FoundEstimate>> = {};
  const listed: Partial<Record<Trade, number>> = {};
  for (const f of figures) {
    if (f.found) estimates[f.trade] = f.found;
    if (f.listed !== undefined) listed[f.trade] = f.listed;
  }
  const { lines } = workOutlook({ city, trades, own: deps.lang, estimates, listed });
  const phrased = await phraseOutlook(deps.ports.model, lines, deps.lang);
  return { id: nextTurnId(), who: MoveSpeaker.outlook, trades, lines, phrased };
}

/** "Which work do you do?", with every trade to tap, for an owner with no card yet. */
const whichWork = (): Turn =>
  agentSays(
    [{ key: "moving.which_work" }],
    Trade.options.map((trade) => ({ label: { key: `trade.${trade}` }, act: { kind: ActKind.trade, trade } })),
  );

/**
 * The owner said they are moving: the outlook for the trades on their card, what to sort first from the city's guide
 * and the buttons, or for a city without a guide, that there is none and what helps anywhere. Without a card, the
 * question which work they do comes last.
 */
export async function startMove(deps: MoveDeps, said: string, city: City | undefined): Promise<void> {
  const ref = openRef();
  say(ref, noteTurn(said));
  const trades = deps.account.worker?.trades ?? [];
  const [guide, outlook] = await Promise.all([
    city ? guideOf(deps, city) : Promise.resolve(undefined),
    trades.length > 0 ? outlookTurn(deps, city, trades) : Promise.resolve(undefined),
  ]);
  const move: Turn = { id: nextTurnId(), who: MoveSpeaker.moving, city, steps: guide ? firstSteps(guide) : [] };
  const unreachable = city !== undefined && !guide;
  const ask = trades.length === 0 && city !== undefined;
  say(ref, ...(outlook ? [outlook] : []), move, ...(unreachable ? [noGuide()] : []), ...(ask ? [whichWork()] : []));
}

/** The owner tapped their work: the outlook for it in the chat's city. */
export async function chooseTrade(deps: MoveDeps, ref: ChatRef, trade: Trade, label: string): Promise<void> {
  say(ref, noteTurn(label));
  say(ref, await outlookTurn(deps, moveCity(turnsOf(ref)), [trade]));
}

const kept = (reply: GuideReply): GuideAnswerKept => (reply.section || reply.topics?.length ? reply : { none: true });

const guideTurn = (city: City, reply: GuideReply): Turn => ({
  id: nextTurnId(),
  who: MoveSpeaker.guide,
  city,
  answer: kept(reply),
});

/** A button or chip answered from the guide: the owner's words, then the guide's reply. */
async function fromGuide(deps: MoveDeps, ref: ChatRef, said: string, city: City, pick: (g: CityGuide) => GuideReply) {
  say(ref, noteTurn(said));
  const guide = await guideOf(deps, city);
  say(ref, guide ? guideTurn(city, pick(guide)) : noGuide());
}

export const showStay = (deps: MoveDeps, ref: ChatRef, said: string, city: City) =>
  fromGuide(deps, ref, said, city, stayReply);

export const showDocuments = (deps: MoveDeps, ref: ChatRef, said: string, city: City) =>
  fromGuide(deps, ref, said, city, documentsReply);

export const showSection = (deps: MoveDeps, ref: ChatRef, said: string, city: City, id: string) =>
  fromGuide(deps, ref, said, city, (guide) => sectionReply(guide, id));

/**
 * A question in a chat about a move, answered from the guide when it has a section for it, or when it asks about
 * something the guide covers (then saying it has nothing yet). False when the words are not about the guide at all,
 * so they go to the agent as any other note.
 */
export async function answerFromGuide(
  deps: MoveDeps,
  said: string,
  city: City,
  answering: () => void,
): Promise<boolean> {
  const ref = openRef();
  const guide = await guideOf(deps, city);
  if (!guide) return false;
  const reply = await questionReply(guide, said, { lang: deps.lang, model: deps.ports.model });
  if (!reply && !asksGuide(said, deps.lang)) return false;
  answering();
  say(ref, noteTurn(said), guideTurn(city, reply ?? {}));
  return true;
}
